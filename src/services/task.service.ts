import { Types } from 'mongoose';
import { Task } from '../models/Task';
import { Project } from '../models/Project';
import { AppError } from '../middleware/errorHandler';
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  ListTasksQuery,
} from '../validation/task.schemas';
import { PaginatedResponse } from '../types';
import { ITask } from '../models/Task';

async function assertProjectAccess(projectId: string, userId: string): Promise<void> {
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
}

export async function createTask(projectId: string, userId: string, input: CreateTaskInput) {
  await assertProjectAccess(projectId, userId);

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
    taskData['assigneeId'] = new Types.ObjectId(input.assigneeId);
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
  await assertProjectAccess(projectId, userId);

  // Construct atomic update operation only for provided fields
  const updateDoc: Record<string, unknown> = {};
  const setFields: Record<string, unknown> = {};
  const unsetFields: Record<string, unknown> = {};

  if (input.title !== undefined) setFields['title'] = input.title;
  if (input.description !== undefined) setFields['description'] = input.description;
  if (input.priority !== undefined) setFields['priority'] = input.priority;

  if (input.assigneeId !== undefined) {
    if (input.assigneeId === null) {
      unsetFields['assigneeId'] = 1;
    } else {
      if (!Types.ObjectId.isValid(input.assigneeId)) {
        throw new AppError(400, 'Invalid assigneeId');
      }
      setFields['assigneeId'] = new Types.ObjectId(input.assigneeId);
    }
  }

  if (Object.keys(setFields).length > 0) {
    updateDoc['$set'] = setFields;
  }
  if (Object.keys(unsetFields).length > 0) {
    updateDoc['$unset'] = unsetFields;
  }

  // Atomic MongoDB update: modifies only the fields specified in the request
  // runValidators ensures Mongoose schema constraints are applied
  // new: true returns the updated document
  const task = await Task.findOneAndUpdate(
    {
      _id: new Types.ObjectId(taskId),
      projectId: new Types.ObjectId(projectId),
    },
    Object.keys(updateDoc).length > 0 ? updateDoc : {},
    { new: true, runValidators: true },
  );

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  return task;
}

export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskStatusInput,
) {
  // Verifies authentication (via middleware) and project access
  await assertProjectAccess(projectId, userId);

  // DEFECT B also applies here: no task-level auth check before update
  const task = await Task.findOne({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  });

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  // DEFECT C: No enum validation — any string status is accepted and persisted
  // The schema uses z.string() instead of z.enum([...]) so we cast directly
  task.status = input.status as ITask['status'];
  await task.save();

  return task;
}

export async function deleteTask(projectId: string, taskId: string, userId: string) {
  // Verifies authentication (via middleware) and project access
  await assertProjectAccess(projectId, userId);

  // DEFECT B: Missing task-level authorization check.
  // Any project member can delete any task in the project.
  const task = await Task.findOneAndDelete({
    _id: new Types.ObjectId(taskId),
    projectId: new Types.ObjectId(projectId),
  });

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  return task;
}
