import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, isDatabaseEnabled } from '../db.js';
import { validateQuery, dateRangeSchema } from '../util/validation.js';
import { cookies, verifyJWT, requireAuth, requireRole } from '../auth/middleware.js';
import { mockPersonalRows, mockCompanyRows, mockEmployeeRows, filterRows } from '../mock/data.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlText = fs.readFileSync(path.join(__dirname, 'queries.sql'), 'utf8');

function extractQuery(name) {
  const regex = new RegExp(`-- name: ${name}[\\s\\S]*?(?=(?:-- name:|$))`, 'i');
  const match = sqlText.match(regex);
  if (!match) throw new Error(`SQL query not found: ${name}`);
  // remove the first line comment
  return match[0].split('\n').slice(1).join('\n').trim();
}

const personalSql = extractQuery('personal');
const companySql = extractQuery('company');
const employeesSql = extractQuery('employees');

const FORCE_MOCK_METRICS = process.env.USE_MOCK_METRICS === 'true';
const allowMockFailover = process.env.MOCK_FAILOVER !== 'false';
let mockMetricsEnabled = FORCE_MOCK_METRICS || !isDatabaseEnabled();

function enableMockMetrics(reason) {
  if (mockMetricsEnabled) return;
  if (!allowMockFailover) return;
  console.warn(`[metrics] falling back to mock data: ${reason}`);
  mockMetricsEnabled = true;
}

function respondWithMock(res, rows) {
  return res.json({ rows });
}

if (mockMetricsEnabled) {
  console.warn('[metrics] Running in mock metrics mode. No database connection detected.');
}

router.use(cookies);
router.use(verifyJWT(true));

router.get(
  '/personal',
  requireAuth,
  validateQuery(dateRangeSchema),
  async (req, res) => {
    const userId = req.user.sub;
    const { from = null, to = null } = req.query;
    try {
      if (mockMetricsEnabled) {
        const rows = filterRows(mockPersonalRows, from, to);
        return respondWithMock(res, rows);
      }
      const result = await query(personalSql, [userId, from, to]);
      const rows = result.rows.map(normalizeRates);
      return res.json({ rows });
    } catch (err) {
      console.error('personal metrics error', err);
      enableMockMetrics(err?.message || err?.code || 'unknown error');
      if (mockMetricsEnabled) {
        const rows = filterRows(mockPersonalRows, from, to);
        return respondWithMock(res, rows);
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/company',
  requireAuth,
  validateQuery(dateRangeSchema),
  async (req, res) => {
    const { from = null, to = null } = req.query;
    try {
      if (mockMetricsEnabled) {
        const rows = filterRows(mockCompanyRows, from, to);
        return respondWithMock(res, rows);
      }
      const result = await query(companySql, [from, to]);
      const rows = result.rows.map(normalizeRates);
      return res.json({ rows });
    } catch (err) {
      console.error('company metrics error', err);
      enableMockMetrics(err?.message || err?.code || 'unknown error');
      if (mockMetricsEnabled) {
        const rows = filterRows(mockCompanyRows, from, to);
        return respondWithMock(res, rows);
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/employees',
  requireRole('admin'),
  validateQuery(dateRangeSchema),
  async (req, res) => {
    const { from = null, to = null } = req.query;
    try {
      if (mockMetricsEnabled) {
        const rows = filterRows(mockEmployeeRows, from, to);
        return respondWithMock(res, rows);
      }
      const result = await query(employeesSql, [from, to]);
      const rows = result.rows.map(normalizeRates);
      return res.json({ rows });
    } catch (err) {
      console.error('employees metrics error', err);
      enableMockMetrics(err?.message || err?.code || 'unknown error');
      if (mockMetricsEnabled) {
        const rows = filterRows(mockEmployeeRows, from, to);
        return respondWithMock(res, rows);
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

function normalizeRates(row) {
  const rateFields = [
    'proposal_rate',
    'recommendation_rate',
    'interview_schedule_rate',
    'interview_held_rate',
    'offer_rate',
    'accept_rate',
    'hire_rate'
  ];

  const normalized = { ...row };
  for (const key of rateFields) {
    const value = row[key];
    normalized[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
  }
  return normalized;
}

export default router;
