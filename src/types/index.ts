import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export type MongoId = Types.ObjectId | string;
