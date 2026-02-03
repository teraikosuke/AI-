import pg from "pg";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import crypto from "crypto";

const { Pool } = pg;

// ---------------------------------------------------------
// 設定・定数
// ---------------------------------------------------------
const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const ses = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION || "ap-northeast-1",
});
const SES_FROM = (process.env.SES_FROM || "").trim();
const SES_TO = (process.env.SES_TO || "").trim();

const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://uqq1qdotaa.execute-api.ap-northeast-1.amazonaws.com/dev";

const MEMBER_ALLOWED_ROLES = (process.env.MEMBER_ALLOWED_ROLES || "advisor,caller,marketing")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8081",
  "http://localhost:3000",
]);

const ALLOW_HEADERS = "content-type,authorization";
const ALLOW_METHODS = "GET,POST,PUT,DELETE,OPTIONS";

const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret-change-me").trim();

// ---------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------
function buildCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(headers, statusCode, bodyObj) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(bodyObj),
  };
}

function html(headers, body) {
  return {
    statusCode: 200,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    body,
  };
}

function parseJsonBody(event) {
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  if (!value) return false;
  if (value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

function getPath(event) {
  return event?.rawPath || event?.path || "";
}

function pickId(event, body) {
  const raw =
    event?.pathParameters?.id ||
    event?.pathParameters?.memberId ||
    event?.queryStringParameters?.id ||
    body?.id ||
    "";
  if (typeof raw !== "string") return "";
  return decodeURIComponent(raw).trim();
}

function base64urlEncodeBuffer(buf) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = base64urlEncodeBuffer(
    crypto.createHmac("sha256", JWT_SECRET).update(data).digest()
  );

  if (signature.length !== expected.length) return null;
  const matches = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!matches) return null;

  let decoded;
  try {
    decoded = JSON.parse(base64urlDecode(payload));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && now > decoded.exp) return null;

  return decoded;
}

function getAuthPayload(event) {
  const authHeader =
    event?.headers?.authorization || event?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  return verifyToken(token);
}

const sendEmailWithTimeout = async (command, timeoutMs = 3000) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`SES Request Timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
  return Promise.race([ses.send(command), timeoutPromise]);
};

async function ensureMemberRequestsTable(client) {
  await client.query(
    `
      CREATE TABLE IF NOT EXISTS member_requests (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending',
        approval_token TEXT,
        request_type TEXT DEFAULT 'create',
        target_user_id BIGINT,
        requested_by TEXT,
        requested_by_name TEXT,
        approved_by TEXT,
        approved_by_name TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  );
  await client.query(
    `
      CREATE INDEX IF NOT EXISTS idx_member_requests_status
      ON member_requests (status);
    `
  );
}

// ---------------------------------------------------------
// メインハンドラー
// ---------------------------------------------------------
export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const path = getPath(event);
  const normalizedPath = path.replace(/\/+$/, "");
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const headers = buildCorsHeaders(origin);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let client;
  try {
    client = await pool.connect();

    // DB接続後に拡張機能を有効化
    if (
      method === "POST" ||
      method === "PUT" ||
      method === "DELETE" ||
      (method === "GET" && normalizedPath.endsWith("/verify"))
    ) {
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    }

    // =================================================================
    // GET /members/verify : メール内リンクの承認処理
    // =================================================================
    if (method === "GET" && normalizedPath.endsWith("/verify")) {
      const qs = event.queryStringParameters || {};
      const token = qs.token;

      if (!token) return html(headers, "<h1>エラー</h1><p>トークンが無効です。</p>");

      await client.query("BEGIN");
      try {
        const reqRes = await client.query(
          "SELECT * FROM member_requests WHERE approval_token = $1 AND status = 'pending' FOR UPDATE",
          [token]
        );

        if (reqRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return html(
            headers,
            "<h1>リンクが無効です</h1><p>この申請はすでに対応済みか、存在しません。</p>"
          );
        }
        const req = reqRes.rows[0];

        // ------------------------------------------
        // パターンA: 削除依頼
        // ------------------------------------------
        if (req.request_type === "delete") {
          const targetId = req.target_user_id;
          const delRes = await client.query(
            "DELETE FROM users WHERE id = $1 RETURNING id, name",
            [targetId]
          );

          if (delRes.rowCount === 0) {
            console.warn("User already deleted:", targetId);
          }

          await client.query(
            "UPDATE member_requests SET status = 'approved', updated_at = NOW(), approved_at = NOW() WHERE id = $1",
            [req.id]
          );
          await client.query("COMMIT");

          return html(
            headers,
            `
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #c53030;">削除完了</h1>
                  <p><b>${req.name}</b> 様の削除処理が完了しました。</p>
                  <p>メンバーリストから削除されています。</p>
                  <p style="color:#666; font-size:12px; margin-top:30px;">ウィンドウを閉じてください</p>
                </body>
              </html>
            `
          );
        }

        // ------------------------------------------
        // パターンB: 新規追加依頼
        // ------------------------------------------
        try {
          await client.query(
            `INSERT INTO users (name, email, role, password_hash, is_admin, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [req.name, req.email, req.role, req.password_hash, req.is_admin]
          );
        } catch (insertErr) {
          if (insertErr.code === "23505") {
            await client.query(
              "UPDATE member_requests SET status = 'approved', updated_at = NOW(), approved_at = NOW() WHERE id = $1",
              [req.id]
            );
            await client.query("COMMIT");
            return html(
              headers,
              "<html><body style=\"padding:50px;text-align:center;\"><h1 style=\"color:#e67e22;\">登録済み</h1><p>すでにメンバー登録されています。</p></body></html>"
            );
          }
          throw insertErr;
        }

        await client.query(
          "UPDATE member_requests SET status = 'approved', updated_at = NOW(), approved_at = NOW() WHERE id = $1",
          [req.id]
        );
        await client.query("COMMIT");

        return html(
          headers,
          `
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #28a745;">承認完了</h1>
                <p><b>${req.name}</b> 様を正式メンバーに追加しました。</p>
                <p style="color:#666; font-size:12px; margin-top:30px;">ウィンドウを閉じてください</p>
              </body>
            </html>
          `
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Verification Error:", err);
        return html(headers, `<h1>システムエラー</h1><p>${err.message}</p>`);
      }
    }

    // 認証必須
    const payload = getAuthPayload(event);
    if (!payload) {
      return json(headers, 401, { error: "Unauthorized" });
    }
    const isAdmin = payload.role === "admin";

    await ensureMemberRequestsTable(client);

    // =================================================================
    // POST /members : 新規申請 (request_type = 'create')
    // =================================================================
    if (method === "POST" && !normalizedPath.endsWith("/approve")) {
      const body = parseJsonBody(event);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const role = typeof body?.role === "string" ? body.role.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const adminFlag = parseBoolean(body?.isAdmin ?? body?.is_admin);
      const normalizedEmail = normalizeEmail(email);
      const normalizedRole = role.toLowerCase();

      if (!name || !email || !role || !password) {
        return json(headers, 400, { error: "Missing required fields" });
      }
      if (!isValidEmail(normalizedEmail)) {
        return json(headers, 400, { error: "email is invalid" });
      }
      if (MEMBER_ALLOWED_ROLES.length && !MEMBER_ALLOWED_ROLES.includes(normalizedRole)) {
        return json(headers, 400, { error: "role is invalid" });
      }

      const userExists = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [normalizedEmail]
      );
      if (userExists.rowCount > 0) {
        return json(headers, 409, { error: "Email already exists" });
      }

      const pendingExists = await client.query(
        "SELECT id FROM member_requests WHERE LOWER(email) = $1 AND status = 'pending' LIMIT 1",
        [normalizedEmail]
      );
      if (pendingExists.rowCount > 0) {
        return json(headers, 409, { error: "Request already pending" });
      }

      const countRes = await client.query("SELECT COUNT(*) FROM users");
      const currentCount = parseInt(countRes.rows[0].count, 10);
      const nextTotal = currentCount + 1;
      const threshold = 5;

      let planStatusHtml = "";
      if (nextTotal <= threshold) {
        planStatusHtml = `
          <div style="background-color: #e6fffa; border: 1px solid #38a169; color: #2f855a; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
            <strong>✅ 基本プラン内</strong><br>現在のメンバー数: <b>${nextTotal}名</b> (あと ${threshold - nextTotal}名)<br><small>追加料金は発生しません。</small>
          </div>`;
      } else {
        planStatusHtml = `
          <div style="background-color: #fff5f5; border: 1px solid #e53e3e; color: #c53030; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
            <strong>⚠️ 追加料金対象</strong><br>現在のメンバー数: <b>${nextTotal}名</b><br><small>この承認で追加料金が発生します。</small>
          </div>`;
      }

      const approvalToken = crypto.randomUUID();

      const insertRes = await client.query(
        `INSERT INTO member_requests (name, email, role, password_hash, is_admin, status, approval_token, request_type)
         VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5, 'pending', $6, 'create')
         RETURNING id`,
        [name, normalizedEmail, normalizedRole, password, adminFlag, approvalToken]
      );
      const newId = insertRes.rows[0].id;
      const approveLink = `${API_BASE_URL}/members/verify?token=${approvalToken}`;

      let mailStatus = "skipped";
      if (SES_FROM && SES_TO) {
        try {
          const command = new SendEmailCommand({
            Source: SES_FROM,
            Destination: { ToAddresses: [SES_TO] },
            Message: {
              Subject: { Data: `【承認依頼】${name}様 (${nextTotal}人目の登録申請)` },
              Body: {
                Html: {
                  Data: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px;">
                  <h2 style="color: #0056b3;">新規メンバー申請</h2>
                  <ul style="background: #f9f9f9; padding: 15px; border-radius: 5px; list-style: none;">
                    <li><b>ID:</b> ${newId}</li>
                    <li><b>名前:</b> ${name}</li>
                    <li><b>Email:</b> ${email}</li>
                    <li><b>権限:</b> ${role}</li>
                  </ul>
                  ${planStatusHtml}
                  <p>
                    <a href="${approveLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">承認してメンバーに追加する</a>
                  </p>
                </div>
              `,
                },
              },
            },
          });
          await sendEmailWithTimeout(command);
          mailStatus = "sent";
        } catch (e) {
          console.error("Email failed:", e);
          mailStatus = "failed";
        }
      }

      return json(headers, 202, {
        message: "Request submitted",
        requestId: newId,
        notification: { status: mailStatus },
      });
    }

    // =================================================================
    // PUT /members : メンバー更新 (管理者はメールも更新可)
    // =================================================================
    if (method === "PUT") {
      const body = parseJsonBody(event);
      const id = pickId(event, body);

      if (!id) return json(headers, 400, { error: "id is required" });

      const selfId = String(
        payload?.sub || payload?.userId || payload?.id || payload?.user?.id || ""
      ).trim();
      const isSelf = Boolean(selfId && String(selfId) === String(id));

      if (!isAdmin && !isSelf) {
        return json(headers, 403, { error: "Forbidden" });
      }

      let result;
      if (isAdmin) {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const email = typeof body?.email === "string" ? body.email.trim() : "";
        const role = typeof body?.role === "string" ? body.role.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        const adminFlag = parseBoolean(body?.isAdmin ?? body?.is_admin);
        const normalizedEmail = normalizeEmail(email);
        const normalizedRole = role.toLowerCase();

        if (!name || !email || !role) {
          return json(headers, 400, { error: "name, email, role are required" });
        }
        if (!isValidEmail(normalizedEmail)) {
          return json(headers, 400, { error: "email is invalid" });
        }
        if (MEMBER_ALLOWED_ROLES.length && !MEMBER_ALLOWED_ROLES.includes(normalizedRole)) {
          return json(headers, 400, { error: "role is invalid" });
        }

        const emailExists = await client.query(
          "SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1",
          [normalizedEmail, id]
        );
        if (emailExists.rowCount > 0) {
          return json(headers, 409, { error: "Email already exists" });
        }

        const params = [name, normalizedEmail, normalizedRole, adminFlag];
        const setClauses = ["name = $1", "email = $2", "role = $3", "is_admin = $4"];
        if (password) {
          params.push(password);
          setClauses.push(`password_hash = crypt($${params.length}, gen_salt('bf'))`);
        }
        setClauses.push("updated_at = NOW()");
        params.push(id);

        result = await client.query(
          `
            UPDATE users
            SET ${setClauses.join(", ")}
            WHERE id = $${params.length}
            RETURNING id, name, email, role, is_admin, created_at, updated_at
          `,
          params
        );
      } else {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const email = typeof body?.email === "string" ? body.email.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        const normalizedEmail = normalizeEmail(email);
        if (!name && !password && !email) {
          return json(headers, 400, { error: "name, email, or password is required" });
        }
        if (email) {
          if (!isValidEmail(normalizedEmail)) {
            return json(headers, 400, { error: "email is invalid" });
          }
          const emailExists = await client.query(
            "SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1",
            [normalizedEmail, id]
          );
          if (emailExists.rowCount > 0) {
            return json(headers, 409, { error: "Email already exists" });
          }
        }

        const params = [];
        const setClauses = [];
        if (name) {
          params.push(name);
          setClauses.push(`name = $${params.length}`);
        }
        if (email) {
          params.push(normalizedEmail);
          setClauses.push(`email = $${params.length}`);
        }
        if (password) {
          params.push(password);
          setClauses.push(`password_hash = crypt($${params.length}, gen_salt('bf'))`);
        }
        setClauses.push("updated_at = NOW()");
        params.push(id);

        result = await client.query(
          `
            UPDATE users
            SET ${setClauses.join(", ")}
            WHERE id = $${params.length}
            RETURNING id, name, email, role, is_admin, created_at, updated_at
          `,
          params
        );
      }

      if (result.rowCount === 0) {
        return json(headers, 404, { error: "Member not found" });
      }

      return json(headers, 200, {
        member: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          email: result.rows[0].email,
          role: result.rows[0].role,
          isAdmin: result.rows[0].is_admin,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        },
      });
    }

    // =================================================================
    // DELETE /members : メンバー削除依頼
    // =================================================================
    if (method === "DELETE") {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      const body = parseJsonBody(event);
      const id = pickId(event, body);

      if (!id) return json(headers, 400, { error: "id is required" });

      const userRes = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      if (userRes.rows.length === 0) return json(headers, 404, { error: "User not found" });
      const targetUser = userRes.rows[0];

      const countRes = await client.query("SELECT COUNT(*) FROM users");
      const currentCount = parseInt(countRes.rows[0].count, 10);
      const nextTotal = currentCount - 1;
      const threshold = 5;

      let planStatusHtml = "";
      if (nextTotal <= threshold) {
        planStatusHtml = `
           <div style="background-color: #e6fffa; border: 1px solid #38a169; color: #2f855a; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
             <strong>✅ 基本プラン内</strong><br>
             削除後のメンバー数: <b>${nextTotal}名</b><br>
             <small>定額プランの範囲内に収まります。</small>
           </div>`;
      } else {
        planStatusHtml = `
           <div style="background-color: #fffaf0; border: 1px solid #dd6b20; color: #c05621; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
             <strong>⚠️ まだ従量課金対象です</strong><br>
             削除後のメンバー数: <b>${nextTotal}名</b><br>
             <small>引き続き追加料金が発生します。</small>
           </div>`;
      }

      const approvalToken = crypto.randomUUID();

      const insertRes = await client.query(
        `INSERT INTO member_requests (name, email, role, password_hash, is_admin, status, approval_token, request_type, target_user_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'delete', $7)
         RETURNING id`,
        [
          targetUser.name,
          targetUser.email,
          targetUser.role,
          targetUser.password_hash,
          targetUser.is_admin,
          approvalToken,
          id,
        ]
      );
      const newId = insertRes.rows[0].id;

      const approveLink = `${API_BASE_URL}/members/verify?token=${approvalToken}`;

      let mailStatus = "skipped";
      if (SES_FROM && SES_TO) {
        try {
          const command = new SendEmailCommand({
            Source: SES_FROM,
            Destination: { ToAddresses: [SES_TO] },
            Message: {
              Subject: { Data: `【削除依頼】${targetUser.name}様の削除リクエスト` },
              Body: {
                Html: {
                  Data: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px;">
                  <h2 style="color: #c53030;">メンバー削除依頼</h2>
                  <p>以下のメンバーの削除申請がありました。</p>

                  <ul style="background: #fff5f5; padding: 15px; border-radius: 5px; list-style: none;">
                    <li><b>ID:</b> ${targetUser.id}</li>
                    <li><b>名前:</b> ${targetUser.name}</li>
                    <li><b>Email:</b> ${targetUser.email}</li>
                  </ul>

                  <h3 style="font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">削除後の状況</h3>
                  ${planStatusHtml}

                  <p>この操作は取り消せません。本当に削除してよろしければ承認してください。</p>

                  <p style="text-align: center; margin: 30px 0;">
                    <a href="${approveLink}" style="background-color: #c53030; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                      承認して削除を実行する
                    </a>
                  </p>
                </div>
              `,
                },
              },
            },
          });
          await sendEmailWithTimeout(command);
          mailStatus = "sent";
        } catch (e) {
          console.error("Email failed:", e);
          mailStatus = "failed";
        }
      }

      return json(headers, 202, {
        message: "Deletion request submitted",
        requestId: newId,
        notification: { status: mailStatus },
      });
    }

    // =================================================================
    // DELETE /members/requests : 申請取り下げ
    // =================================================================
    if (method === "DELETE" && normalizedPath.endsWith("/requests")) {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      const body = parseJsonBody(event);
      const id = pickId(event, body);
      if (!id) return json(headers, 400, { error: "id is required" });

      const res = await client.query(
        "UPDATE member_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id",
        [id]
      );
      if (res.rowCount === 0) {
        return json(headers, 404, { error: "Request not found or already processed" });
      }
      return json(headers, 200, { cancelled: true, id: res.rows[0].id });
    }

    // =================================================================
    // GET /members/requests
    // =================================================================
    if (method === "GET" && normalizedPath.endsWith("/requests")) {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      const qs = event.queryStringParameters || {};
      const status = qs.status || "pending";
      const res = await client.query(
        "SELECT * FROM member_requests WHERE status=$1 ORDER BY created_at DESC",
        [status]
      );
      return json(headers, 200, { items: res.rows });
    }

    // =================================================================
    // GET /members
    // =================================================================
    if (method === "GET") {
      const res = await client.query(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      return json(headers, 200, { items: res.rows });
    }

    return json(headers, 404, { error: "Not Found" });
  } catch (e) {
    console.error("Lambda Error:", e);
    if (client) await client.query("ROLLBACK").catch(() => {});
    return json(headers, 500, { error: e.message });
  } finally {
    if (client) client.release();
  }
};
