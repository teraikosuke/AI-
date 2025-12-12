import express from 'express';
import dotenv from 'dotenv';
import { query, isDatabaseEnabled } from '../db.js';
import { verifyPassword } from './hash.js';
import { signUserToken } from './jwt.js';
import { cookies, verifyJWT, requireAuth } from './middleware.js';
import { validateBody, loginSchema } from '../util/validation.js';
import { mockUsers } from '../mock/data.js';

dotenv.config();

const router = express.Router();

const COOKIE_NAME = process.env.COOKIE_NAME || 'sid';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FORCE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true';
const allowMockFailover = process.env.MOCK_FAILOVER !== 'false';
let mockAuthEnabled = FORCE_MOCK_AUTH || !isDatabaseEnabled();

function enableMockAuth(reason) {
  if (mockAuthEnabled) return;
  if (!allowMockFailover) return;
  console.warn(`[auth] falling back to mock mode: ${reason}`);
  mockAuthEnabled = true;
}

function handleMockLogin(req, res) {
  const { email, password } = req.body;
  const mockUser = mockUsers.find(user => user.email === email && user.password === password);
  if (!mockUser) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signUserToken(mockUser);
  setAuthCookie(res, token);
  return res.json({
    success: true,
    user: {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      role: mockUser.role
    }
  });
}

if (mockAuthEnabled) {
  console.warn('[auth] Running in mock-auth mode. Use admin@example.com / admin123 or user@example.com / user123.');
}

function setAuthCookie(res, token) {
  const isProd = NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProd ? true : false,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  };
  if (COOKIE_DOMAIN && COOKIE_DOMAIN !== 'localhost') {
    options.domain = COOKIE_DOMAIN;
  }
  res.cookie(COOKIE_NAME, token, options);
}

function clearAuthCookie(res) {
  const options = {
    httpOnly: true,
    sameSite: 'lax'
  };
  if (COOKIE_DOMAIN && COOKIE_DOMAIN !== 'localhost') {
    options.domain = COOKIE_DOMAIN;
  }
  res.clearCookie(COOKIE_NAME, options);
}

router.use(cookies);

router.post(
  '/login',
  validateBody(loginSchema),
  async (req, res) => {
    const { email, password } = req.body;

    try {
      if (mockAuthEnabled) {
        return handleMockLogin(req, res);
      }

      const result = await query(
        'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const valid = await verifyPassword(user.password_hash, password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signUserToken(user);
      setAuthCookie(res, token);

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      console.error('Login error', err);
      enableMockAuth(err?.message || err?.code || 'unknown error');
      if (mockAuthEnabled) {
        return handleMockLogin(req, res);
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

router.get('/me', verifyJWT(true), requireAuth, async (req, res) => {
  const user = req.user;
  return res.json({
    id: user.sub,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

export default router;
