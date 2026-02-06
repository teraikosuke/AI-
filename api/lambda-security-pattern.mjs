/**
 * =============================================================================
 * Lambda関数 共通ユーティリティ (修正後のパターン)
 * =============================================================================
 * 
 * このファイルは、全Lambda関数で使用すべき共通のセキュリティ設定を定義します。
 * 各Lambda関数の index.mjs を以下のパターンに修正してください。
 * 
 * 対象Lambda関数 (22個):
 * - ats-api-dev-auth-login
 * - ats-api-dev-auth-me
 * - ats-api-dev-candidates-detail
 * - ats-api-dev-candidates-list
 * - ats-api-dev-clients-create
 * - ats-api-dev-goal-settings
 * - ats-api-dev-kpi-ads
 * - ats-api-dev-kpi-ads-detail
 * - ats-api-dev-kpi-clients
 * - ats-api-dev-kpi-clients-edit
 * - ats-api-dev-kpi-targets
 * - ats-api-dev-kpi-teleapo
 * - ats-api-dev-kpi-yield
 * - ats-api-dev-kpi-yield-daily
 * - ats-api-dev-kpi-yield-personal
 * - ats-api-dev-members
 * - ats-api-dev-ms-targets
 * - ats-api-dev-mypage
 * - ats-api-dev-teleapo-candidate-contact
 * - ats-api-dev-teleapo-log-create
 * - ats-api-dev-teleapo-logs
 * - ats-api-settings-screening-rules
 */

import pg from "pg";
const { Pool } = pg;

// =============================================================================
// 環境変数の検証 (起動時にチェック)
// =============================================================================

/**
 * 必須環境変数の検証
 * 本番環境では環境変数が未設定の場合にエラーをスローします
 */
function validateEnvironment() {
    const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    const missing = required.filter((key) => !process.env[key]?.trim());

    if (missing.length > 0) {
        const error = `Missing required environment variables: ${missing.join(", ")}`;
        console.error(error);
        // 開発環境では警告のみ、本番環境ではエラー
        if (process.env.NODE_ENV === "production") {
            throw new Error(error);
        }
    }
}

// 起動時に検証
validateEnvironment();

// =============================================================================
// データベース接続設定
// =============================================================================

const pool = new Pool({
    host: (process.env.DB_HOST || "").trim(),
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // 本番環境ではSSL証明書を正しく検証することを推奨
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
});

// =============================================================================
// CORS設定 (環境変数から取得)
// =============================================================================

/**
 * 許可するオリジンのセットを構築
 * 環境変数 CORS_ALLOWED_ORIGINS からカンマ区切りで取得
 */
function buildAllowedOrigins() {
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS || "";
    const defaultOrigins = ["http://localhost:8000", "http://localhost:8001"];

    if (!envOrigins.trim()) {
        // 本番環境で未設定の場合は警告
        if (process.env.NODE_ENV === "production") {
            console.warn("CORS_ALLOWED_ORIGINS is not set. Using restrictive default.");
            return new Set(); // 本番では空セット（オリジン拒否）
        }
        return new Set(defaultOrigins);
    }

    const origins = envOrigins
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

    return new Set(origins);
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
};

/**
 * リクエストに応じたCORSヘッダーを構築
 */
function buildHeaders(event) {
    const origin = event?.headers?.origin || event?.headers?.Origin || "";

    // オリジンが許可リストにある場合のみそのオリジンを返す
    // そうでない場合は Access-Control-Allow-Origin を設定しない（CORS拒否）
    if (ALLOWED_ORIGINS.has(origin)) {
        return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
    }

    // 本番環境ではワイルドカードを使用しない
    if (process.env.NODE_ENV === "production") {
        return baseHeaders; // Access-Control-Allow-Origin なし = CORS拒否
    }

    // 開発環境では後方互換性のためワイルドカードを許可
    return { ...baseHeaders, "Access-Control-Allow-Origin": "*" };
}

// =============================================================================
// JWT認証設定
// =============================================================================

/**
 * JWT Secretの取得と検証
 */
function getJwtSecret() {
    const secret = (process.env.JWT_SECRET || "").trim();

    if (!secret) {
        const error = "JWT_SECRET environment variable is not set";
        console.error(error);

        // 本番環境では必須
        if (process.env.NODE_ENV === "production") {
            throw new Error(error);
        }

        // 開発環境のみフォールバック（警告付き）
        console.warn("Using fallback JWT secret - DO NOT USE IN PRODUCTION!");
        return "dev-secret-change-me-immediately";
    }

    // シークレットの強度チェック
    if (secret.length < 32) {
        console.warn("JWT_SECRET is too short. Recommended: 32+ characters");
    }

    return secret;
}

const JWT_SECRET = getJwtSecret();
const TOKEN_TTL_HOURS = Number(process.env.JWT_TTL_HOURS || 12);

// =============================================================================
// エラーハンドリング
// =============================================================================

/**
 * 安全なエラーレスポンスを生成
 * 本番環境では内部エラーの詳細を隠蔽
 */
function safeErrorResponse(err, headers, statusCode = 500) {
    console.error("LAMBDA ERROR:", err);

    const isDev = process.env.NODE_ENV !== "production";

    return {
        statusCode,
        headers,
        body: JSON.stringify({
            error: isDev ? err.message : "Internal server error",
            // 開発環境のみスタックトレースを含める
            ...(isDev && { stack: err.stack }),
        }),
    };
}

// =============================================================================
// ヘルパー関数
// =============================================================================

function parseJsonBody(event) {
    if (!event?.body) return null;
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function json(statusCode, bodyObj, headers) {
    return {
        statusCode,
        headers,
        body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
    };
}

// =============================================================================
// エクスポート
// =============================================================================

export {
    pool,
    buildHeaders,
    parseJsonBody,
    json,
    safeErrorResponse,
    JWT_SECRET,
    TOKEN_TTL_HOURS,
    ALLOWED_ORIGINS,
};
