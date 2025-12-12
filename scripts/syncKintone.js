#!/usr/bin/env node
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:devpass@localhost:5432/ats",
});

const SYNC_SOURCE = "kintone";
const PAGE_LIMIT = 500;
const INITIAL_IMPORT_LIMIT = 100;
const UPDATED_TIME_FIELD = "更新日時";

const FIELD_MAPPING = {
  registered_date: "登録日",
  source: "応募経路_0",
  company_name: "応募企業名",
  job_name: "応募求人名",
  candidate_name: "求職者名",
  phone: "電話番号",
  birthday: "生年月日",
  age: "年齢",
  email: "メールアドレス",
};

async function getKintoneSettings(client) {
  const { rows } = await client.query(
    "SELECT * FROM ats_settings WHERE id = 1"
  );
  if (rows.length === 0) {
    throw new Error(
      "kintoneの接続設定が登録されていません。システム設定画面から保存してください。"
    );
  }
  return rows[0];
}

async function getLastSyncedAt(client) {
  const { rows } = await client.query(
    "SELECT last_synced_at FROM sync_state WHERE source = $1",
    [SYNC_SOURCE]
  );
  if (rows.length === 0) {
    return new Date("2000-01-01T00:00:00Z");
  }
  return rows[0].last_synced_at || new Date("2000-01-01T00:00:00Z");
}

async function updateLastSyncedAt(client, timestamp) {
  await client.query(
    `
      INSERT INTO sync_state (source, last_synced_at)
      VALUES ($1, $2)
      ON CONFLICT (source) DO UPDATE
      SET last_synced_at = EXCLUDED.last_synced_at
    `,
    [SYNC_SOURCE, timestamp]
  );
}

function buildQuery(isInitial, lastSyncedAt, offset = 0) {
  if (isInitial) {
    return `order by ${UPDATED_TIME_FIELD} desc limit ${INITIAL_IMPORT_LIMIT}`;
  }
  const iso = new Date(lastSyncedAt).toISOString().replace(/\.\d{3}Z$/, "Z");
  return `${UPDATED_TIME_FIELD} >= "${iso}" order by ${UPDATED_TIME_FIELD} asc limit ${PAGE_LIMIT} offset ${offset}`;
}

function mapRecord(record) {
  const get = (code) => record[code]?.value ?? null;
  const registeredDateTime = normalizeDateTime(get(FIELD_MAPPING.registered_date));
  const registeredDate = registeredDateTime
    ? registeredDateTime.split("T")[0]
    : normalizeDate(get(FIELD_MAPPING.registered_date));
  const birthday = normalizeDate(get(FIELD_MAPPING.birthday));
  const ageValue = parseInt(get(FIELD_MAPPING.age), 10);
  return {
    kintone_record_id: parseInt(record.$id.value, 10),
    candidate_name: get(FIELD_MAPPING.candidate_name),
    company_name: get(FIELD_MAPPING.company_name),
    job_name: get(FIELD_MAPPING.job_name),
    registered_date: registeredDate,
    registered_at: registeredDateTime,
    source: get(FIELD_MAPPING.source),
    phone: get(FIELD_MAPPING.phone),
    email: get(FIELD_MAPPING.email),
    birthday,
    age: Number.isNaN(ageValue) ? null : ageValue,
    kintone_updated_time: normalizeDateTime(record["更新日時"]?.value),
  };
}

function normalizeDate(value) {
  if (!value) return null;
  return value.split("T")[0];
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function fetchKintoneRecords(settings, query) {
  const params = new URLSearchParams({
    app: settings.kintone_app_id,
    query,
  });
  const endpoint = `https://${settings.kintone_subdomain}.cybozu.com/k/v1/records.json?${params.toString()}`;
  const response = await fetch(endpoint, {
    headers: {
      "X-Cybozu-API-Token": settings.kintone_api_token,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `kintone API エラー (${response.status}): ${text.slice(0, 400)}`
    );
  }
  return response.json();
}

async function upsertCandidate(client, payload) {
  const values = [
    payload.kintone_record_id,
    payload.candidate_name,
    payload.company_name,
    payload.job_name,
    payload.registered_date,
    payload.registered_at,
    payload.source,
    payload.phone,
    payload.email,
    payload.birthday,
    payload.age,
    payload.kintone_updated_time,
  ];

  await client.query(
    `
      INSERT INTO candidates (
        kintone_record_id,
        candidate_name,
        company_name,
        job_name,
        registered_date,
        registered_at,
        source,
        phone,
        email,
        birthday,
        age,
        kintone_updated_time
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (kintone_record_id) DO UPDATE SET
        candidate_name = EXCLUDED.candidate_name,
        company_name = EXCLUDED.company_name,
        job_name = EXCLUDED.job_name,
        registered_date = EXCLUDED.registered_date,
        registered_at = EXCLUDED.registered_at,
        source = EXCLUDED.source,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        birthday = EXCLUDED.birthday,
        age = EXCLUDED.age,
        kintone_updated_time = EXCLUDED.kintone_updated_time,
        updated_at = NOW()
    `,
    values
  );
}

async function sync() {
  const client = await pool.connect();
  console.log("Starting kintone sync...");
  try {
    const settings = await getKintoneSettings(client);
    const lastSyncedAt = await getLastSyncedAt(client);
    const isInitialSync =
      !lastSyncedAt || new Date(lastSyncedAt).getFullYear() === 2000;
    const lastSyncedIso = isInitialSync
      ? null
      : new Date(lastSyncedAt).toISOString();
    console.log(
      `Last synced at: ${
        lastSyncedIso ?? "initial sync (latest 100 records only)"
      }`
    );

    let offset = 0;
    let processed = 0;
    let latestTimestamp = lastSyncedIso;

    while (true) {
      const query = buildQuery(isInitialSync, lastSyncedIso, offset);
      const { records } = await fetchKintoneRecords(settings, query);
      if (!records || records.length === 0) {
        break;
      }

      for (const record of records) {
        const mapped = mapRecord(record);
        await upsertCandidate(client, mapped);
        processed += 1;
        const updatedTime = normalizeDateTime(record[UPDATED_TIME_FIELD]?.value);
        if (updatedTime && updatedTime > (latestTimestamp || "")) {
          latestTimestamp = updatedTime;
        }
      }

      if (isInitialSync) {
        break;
      } else {
        offset += records.length;
        if (records.length < PAGE_LIMIT) {
          break;
        }
      }
    }

    if (processed > 0 && (latestTimestamp || isInitialSync)) {
      await updateLastSyncedAt(client, latestTimestamp || new Date().toISOString());
    }

    console.log(
      `kintone sync completed. processed=${processed}, lastSyncedAt=${latestTimestamp}`
    );
  } catch (error) {
    console.error("kintone sync failed", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

sync();
