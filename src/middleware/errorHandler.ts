import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Log unexpected errors
  console.error('[ErrorHandler] Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(config.isProduction ? {} : { detail: String(err) }),
  });
}
