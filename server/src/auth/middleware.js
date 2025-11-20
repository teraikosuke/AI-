import cookieParser from 'cookie-parser';
import { verifyToken } from './jwt.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'sid';

export const cookies = cookieParser();

export function verifyJWT(optional = false) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      if (optional) return next();
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (err) {
      console.warn('JWT verification failed', err.message);
      if (optional) return next();
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

