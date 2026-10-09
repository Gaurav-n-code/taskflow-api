import { z } from 'zod';

const taskStatusValues = ['todo', 'in_progress', 'completed'] as const;
const taskPriorityValues = ['low', 'medium', 'high'] as const;

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(300, 'Title too long').trim(),
    description: z.string().max(2000, 'Description too long').trim().optional().default(''),
    status: z.enum(taskStatusValues).optional().default('todo'),
    priority: z.enum(taskPriorityValues).optional().default('medium'),
    assigneeId: z.string().optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300).trim().optional(),
    description: z.string().max(2000).trim().optional(),
    priority: z.enum(taskPriorityValues).optional(),
    assigneeId: z.string().nullable().optional(),
  }),
});

export const updateTaskStatusSchema = z.object({
  body: z.object({
    status: z.enum(taskStatusValues, {
      errorMap: () => ({
        message: "Status must be one of 'todo', 'in_progress', or 'completed'",
      }),
    }),
  }),
});

export const listTasksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => parseInt(v ?? '1', 10))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => parseInt(v ?? '20', 10))
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(taskPriorityValues).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
