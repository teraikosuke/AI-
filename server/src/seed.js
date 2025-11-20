import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { query, getClient } from './db.js';
import { hashPassword } from './auth/hash.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedUsers(client) {
  console.log('Seeding users...');
  const adminHash = await hashPassword('admin123');
  const memberHash = await hashPassword('member123');
  const analystHash = await hashPassword('analyst123');
  const salesHash = await hashPassword('sales123');
  const designerHash = await hashPassword('designer123');
  const hrHash = await hashPassword('hr123');

  const insertSql = `
    INSERT INTO users (email, password_hash, name, role)
    VALUES
      ($1, $2, $3, 'admin'),
      ($4, $5, $6, 'member'),
      ($7, $8, $9, 'member'),
      ($10, $11, $12, 'member'),
      ($13, $14, $15, 'member'),
      ($16, $17, $18, 'member')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role;
  `;

  const res = await client.query(insertSql, [
    'admin@example.com',
    adminHash,
    '高橋 智也',
    'member@example.com',
    memberHash,
    '佐々木 美咲',
    'analyst@example.com',
    analystHash,
    '田中 修平',
    'sales@example.com',
    salesHash,
    '山本 拓海',
    'designer@example.com',
    designerHash,
    '石川 花蓮',
    'hr@example.com',
    hrHash,
    '斎藤 萌'
  ]);

  console.log('Users seeded:', res.rowCount);

  // fetch ids for metrics seeding
  const usersRes = await client.query(
    'SELECT id, email FROM users WHERE email IN ($1, $2, $3, $4, $5, $6)',
    [
      'admin@example.com',
      'member@example.com',
      'analyst@example.com',
      'sales@example.com',
      'designer@example.com',
      'hr@example.com'
    ]
  );

  const users = {};
  for (const row of usersRes.rows) {
    users[row.email] = row.id;
  }
  return users;
}

function generateMetricsRows(userId, startDate, days) {
  const rows = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    const new_interviews = 3 + (i % 4);
    const proposals = 2 + (i % 3);
    const recommendations = 1 + (i % 3);
    const interviews_scheduled = 1 + (i % 2);
    const interviews_held = 1 + (i % 2);
    const offers = i % 3 === 0 ? 1 : 0;
    const accepts = i % 4 === 0 ? 1 : 0;

    rows.push({
      user_id: userId,
      date: dateStr,
      new_interviews,
      proposals,
      recommendations,
      interviews_scheduled,
      interviews_held,
      offers,
      accepts
    });
  }
  return rows;
}

async function seedMetrics(client, users) {
  console.log('Seeding metrics_daily...');
  const startDate = '2025-01-01';
  const days = 335;

  const rows = [
    ...generateMetricsRows(users['admin@example.com'], startDate, days),
    ...generateMetricsRows(users['member@example.com'], startDate, days),
    ...generateMetricsRows(users['analyst@example.com'], startDate, days),
    ...generateMetricsRows(users['sales@example.com'], startDate, days),
    ...generateMetricsRows(users['designer@example.com'], startDate, days),
    ...generateMetricsRows(users['hr@example.com'], startDate, days)
  ];

  const insertSql = `
    INSERT INTO metrics_daily
      (user_id, date, new_interviews, proposals, recommendations,
       interviews_scheduled, interviews_held, offers, accepts)
    VALUES
      ${rows
        .map(
          (_, i) =>
            `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
        )
        .join(', ')}
    ON CONFLICT DO NOTHING;
  `;

  const values = [];
  for (const r of rows) {
    values.push(
      r.user_id,
      r.date,
      r.new_interviews,
      r.proposals,
      r.recommendations,
      r.interviews_scheduled,
      r.interviews_held,
      r.offers,
      r.accepts
    );
  }

  await client.query(insertSql, values);
  console.log('metrics_daily seeded:', rows.length);
}

async function runSeed() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const users = await seedUsers(client);
    await seedMetrics(client, users);
    await client.query('COMMIT');
    console.log('Seeding completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

runSeed();
