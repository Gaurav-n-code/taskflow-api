import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { RegisterInput, LoginInput } from '../validation/auth.schemas';

export async function register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as RegisterInput;
    const result = await authService.registerUser(input);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as LoginInput;
    const result = await authService.loginUser(input);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const result = await authService.getMe(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
