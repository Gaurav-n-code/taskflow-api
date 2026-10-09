import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, AuthenticatedUser } from '../types';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    } satisfies AuthenticatedUser;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
