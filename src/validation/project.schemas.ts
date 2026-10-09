import { z } from 'zod';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(200, 'Name too long').trim(),
    description: z.string().max(1000, 'Description too long').trim().optional().default(''),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type AddMemberInput = z.infer<typeof addMemberSchema>['body'];
