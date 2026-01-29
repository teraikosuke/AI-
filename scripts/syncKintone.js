#!/usr/bin/env node
const { execSync } = require("child_process");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

// Settings
const KINTONE_SUBDOMAIN = process.env.KINTONE_SUBDOMAIN;
const KINTONE_APP_ID = process.env.KINTONE_APP_ID;
const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN;
const PAGE_LIMIT = 500;
const UPDATED_TIME_FIELD = "更新日時";

if (!KINTONE_SUBDOMAIN || !KINTONE_APP_ID || !KINTONE_API_TOKEN) {
  console.error("-- Error: KINTONE env variables are required in .env --");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  partner_name: "担当アドバイザー",
  cs_name: "担当CS",
};

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

function normalizeKintoneValue(value) {
  if (!value) return null;
  // Kintone User Selection / Organization Selection field is an array of objects
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    // Join all names with comma
    return value.map((v) => v.name).filter(Boolean).join(", ") || null;
  }
  return value;
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
    partner_name: normalizeKintoneValue(get(FIELD_MAPPING.partner_name)),
    cs_name: normalizeKintoneValue(get(FIELD_MAPPING.cs_name)),
    kintone_updated_time: normalizeDateTime(record[UPDATED_TIME_FIELD]?.value),
  };
}

function fetchKintoneRecords(query) {
  const params = new URLSearchParams({
    app: KINTONE_APP_ID,
    query,
  });
  const url = `https://${KINTONE_SUBDOMAIN}.cybozu.com/k/v1/records.json?${params.toString()}`;

  // Use curl via execSync to bypass node fetch/network issues
  // -s: silent
  const cmd = `curl -s -H "X-Cybozu-API-Token: ${KINTONE_API_TOKEN}" "${url}"`;

  try {
    const stdout = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (e) {
    console.error(`-- Error fetching Kintone: ${e.message}`);
    // If JSON parse fails, stdout might contain error html or empty
    return { records: [] };
  }
}

async function main() {
  console.log("-- Starting sync logic --");
  const client = await pool.connect();

  try {
    // Fetch all recent records (limit 500)
    const query = `order by ${UPDATED_TIME_FIELD} desc limit ${PAGE_LIMIT}`;
    const data = fetchKintoneRecords(query);

    if (!data || !data.records) {
      console.log("-- No records found or API error --");
      return;
    }

    console.log(`-- Fetched ${data.records.length} records. applying to DB... --`);

    await client.query("BEGIN");

    for (const record of data.records) {
      const p = mapRecord(record);

      const text = `
        INSERT INTO candidates (
          kintone_record_id, candidate_name, company_name, job_name, 
          registered_date, registered_at, source, phone, email, 
          birthday, age, partner_name, cs_name, kintone_updated_time, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
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
          partner_name = COALESCE(candidates.partner_name, EXCLUDED.partner_name),
          cs_name = COALESCE(candidates.cs_name, EXCLUDED.cs_name),
          kintone_updated_time = EXCLUDED.kintone_updated_time,
          updated_at = NOW()
      `;

      const values = [
        p.kintone_record_id,
        p.candidate_name,
        p.company_name,
        p.job_name,
        p.registered_date,
        p.registered_at,
        p.source,
        p.phone,
        p.email,
        p.birthday,
        p.age,
        p.partner_name,
        p.cs_name,
        p.kintone_updated_time
      ];

      await client.query(text, values);
    }

    // Update sync state
    await client.query(`
      INSERT INTO sync_state (source, last_synced_at)
      VALUES ($1, NOW())
      ON CONFLICT (source) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
    `, ['kintone']);

    await client.query("COMMIT");
    console.log("-- Sync Complete --");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Sync failed:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
