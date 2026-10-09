import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as projectService from '../services/project.service';
import { CreateProjectInput, AddMemberInput } from '../validation/project.schemas';

export async function createProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const input = req.body as CreateProjectInput;
    const project = await projectService.createProject(req.user.id, input);
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function listProjects(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const projects = await projectService.listProjects(req.user.id);
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

export async function getProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const project = await projectService.getProject(req.params['projectId'] as string, req.user.id);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function addMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const input = req.body as AddMemberInput;
    const project = await projectService.addProjectMember(
      req.params['projectId'] as string,
      req.user.id,
      input,
    );
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}
