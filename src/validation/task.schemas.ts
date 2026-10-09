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

// DEFECT C: This schema accepts any string for status — no enum enforcement
export const updateTaskStatusSchema = z.object({
  body: z.object({
    status: z.string().min(1, 'Status is required'),
  }),
});

export const listTasksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .refine((v) => v === undefined || /^[+-]?\d+$/.test(v.trim()), {
      message: 'Page must be an integer',
    })
    .transform((v) => (v === undefined ? 1 : Number(v)))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .refine((v) => v === undefined || /^[+-]?\d+$/.test(v.trim()), {
      message: 'Limit must be an integer',
    })
    .transform((v) => (v === undefined ? 20 : Number(v)))
    .pipe(
      z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must not exceed 100'),
    ),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(taskPriorityValues).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
