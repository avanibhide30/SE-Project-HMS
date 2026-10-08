import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured before starting the backend.');
}

export const JWT_SECRET = jwtSecret;
export const isDevelopment = process.env.NODE_ENV === 'development';
