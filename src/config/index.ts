import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  mongodbUri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/taskflow',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10),
  isProduction: process.env['NODE_ENV'] === 'production',
} as const;
