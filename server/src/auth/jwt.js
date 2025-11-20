import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_HOURS = 12;

export function signUserToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${TOKEN_TTL_HOURS}h`
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

