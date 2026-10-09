import { Types } from 'mongoose';
import { Task } from '../models/Task';
import { Project, IProject } from '../models/Project';
import { AppError } from '../middleware/errorHandler';
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  ListTasksQuery,
} from '../validation/task.schemas';
import { PaginatedResponse } from '../types';
import { ITask } from '../models/Task';

async function assertProjectAccess(projectId: string, userId: string): Promise<IProject> {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  const userObjectId = new Types.ObjectId(userId);
  const isOwner = project.owner.equals(userObjectId);
  const isMember = project.members.some((m) => m.equals(userObjectId));
  if (!isOwner && !isMember) {
    throw new AppError(403, 'Access denied: you are not a member of this project');
  }
  return project;
}

function assertTaskModifyAccess(
  project: IProject,
  task: ITask,
  userId: string,
  operation: 'update' | 'delete',
): void {
  const userObjectId = new Types.ObjectId(userId);
  const isProjectOwner = project.owner.equals(userObjectId);
  const isTaskCreator = task.createdBy.equals(userObjectId);
  const isAssignee = task.assigneeId ? task.assigneeId.equals(userObjectId) : false;

  // Task creators, project owners, and assignees can update; creators and project owners can delete
  const isAuthorized =
    operation === 'delete'
      ? isProjectOwner || isTaskCreator
      : isProjectOwner || isTaskCreator || isAssignee;

  if (!isAuthorized) {
    throw new AppError(403, `Access denied: you are not authorized to ${operation} this task`);
  }
}

export async function createTask(projectId: string, userId: string, input: CreateTaskInput) {
  const project = await assertProjectAccess(projectId, userId);

  const taskData: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    projectId: new Types.ObjectId(projectId),
    createdBy: new Types.ObjectId(userId),
  };

  if (input.assigneeId) {
    if (!Types.ObjectId.isValid(input.assigneeId)) {
      throw new AppError(400, 'Invalid assigneeId');
    }
    const assigneeObjectId = new Types.ObjectId(input.assigneeId);
    const isAssigneeProjectMember =
      project.owner.equals(assigneeObjectId) ||
      project.members.some((m) => m.equals(assigneeObjectId));
    if (!isAssigneeProjectMember) {
      throw new AppError(400, 'Assignee must be a member of the project');
    }
    taskData['assigneeId'] = assigneeObjectId;
  }

  const task = await Task.create(taskData);
  return task;
}

export async function listTasks(
  projectId: string,
  userId: string,
  query: ListTasksQuery,
): Promise<PaginatedResponse<ITask>> {
  await assertProjectAccess(projectId, userId);

  const { page, limit, status, priority } = query;

  const filter: Record<string, unknown> = { projectId: new Types.ObjectId(projectId) };
  if (status) filter['status'] = status;
  if (priority) filter['priority'] = priority;

  const total = await Task.countDocuments(filter);

  // DEFECT A: Pagination off-by-one — uses page * limit instead of (page - 1) * limit
  const offset = page * limit;

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate('createdBy', 'id name email')
    .populate('assigneeId', 'id name email');

  const totalPages = Math.ceil(total / limit);

  return {
    data: tasks,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export async function getTask(projectId: string, taskId: string, userId: string) {
  await assertProjectAccess(projectId, userId);

  const task = await Task.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  })
    .populate('createdBy', 'id name email')
    .populate('assigneeId', 'id name email');

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  return task;
}

export async function updateTask(
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskInput,
) {
  // Verifies authentication (via middleware) and project access
  const project = await assertProjectAccess(projectId, userId);

  const task = await Task.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  });

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  // Enforce task-level authorization: project owner, task creator, or assignee can update
  assertTaskModifyAccess(project, task, userId, 'update');

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.assigneeId !== undefined) {
    if (input.assigneeId === null) {
      task.assigneeId = undefined;
    } else {
      if (!Types.ObjectId.isValid(input.assigneeId)) {
        throw new AppError(400, 'Invalid assigneeId');
      }
      const newAssigneeId = new Types.ObjectId(input.assigneeId);
      const isAssigneeProjectMember =
        project.owner.equals(newAssigneeId) || project.members.some((m) => m.equals(newAssigneeId));
      if (!isAssigneeProjectMember) {
        throw new AppError(400, 'Assignee must be a member of the project');
      }
      task.assigneeId = newAssigneeId;
    }
  }

  await task.save();
  return task;
}

export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskStatusInput,
) {
  // Verifies authentication (via middleware) and project access
  const project = await assertProjectAccess(projectId, userId);

  const task = await Task.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  });

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  // Enforce task-level authorization: project owner, task creator, or assignee can update status
  assertTaskModifyAccess(project, task, userId, 'update');

  // DEFECT C: No enum validation — any string status is accepted and persisted
  // The schema uses z.string() instead of z.enum([...]) so we cast directly
  task.status = input.status as ITask['status'];
  await task.save();

  return task;
}

export async function deleteTask(projectId: string, taskId: string, userId: string) {
  // Verifies authentication (via middleware) and project access
  const project = await assertProjectAccess(projectId, userId);

  const task = await Task.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  });

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  // Enforce task-level authorization: project owner or task creator can delete
  assertTaskModifyAccess(project, task, userId, 'delete');

  await task.deleteOne();

  return task;
}
