import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as taskService from '../services/task.service';
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from '../validation/task.schemas';
import { listTasksQuerySchema } from '../validation/task.schemas';

export async function createTask(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const input = req.body as CreateTaskInput;
    const task = await taskService.createTask(
      req.params['projectId'] as string,
      req.user.id,
      input,
    );
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function listTasks(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const query = listTasksQuerySchema.parse(req.query);
    const result = await taskService.listTasks(
      req.params['projectId'] as string,
      req.user.id,
      query,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const task = await taskService.getTask(
      req.params['projectId'] as string,
      req.params['taskId'] as string,
      req.user.id,
    );
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const input = req.body as UpdateTaskInput;
    const task = await taskService.updateTask(
      req.params['projectId'] as string,
      req.params['taskId'] as string,
      req.user.id,
      input,
    );
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function updateTaskStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const input = req.body as UpdateTaskStatusInput;
    const task = await taskService.updateTaskStatus(
      req.params['projectId'] as string,
      req.params['taskId'] as string,
      req.user.id,
      input,
    );
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    await taskService.deleteTask(
      req.params['projectId'] as string,
      req.params['taskId'] as string,
      req.user.id,
    );
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}
