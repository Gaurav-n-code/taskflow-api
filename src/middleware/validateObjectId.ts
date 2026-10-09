import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../types';

export function validateObjectId(paramName: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const id = req.params[paramName] as string;
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: `Invalid ${paramName}` });
      return;
    }
    next();
  };
}
