import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../validation/validate';
import { validateObjectId } from '../middleware/validateObjectId';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validation/task.schemas';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '../controllers/task.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(validateObjectId('projectId'));

router.post('/', validate(createTaskSchema), createTask);
router.get('/', listTasks);
router.get('/:taskId', validateObjectId('taskId'), getTask);
router.patch('/:taskId', validateObjectId('taskId'), validate(updateTaskSchema), updateTask);
router.patch(
  '/:taskId/status',
  validateObjectId('taskId'),
  validate(updateTaskStatusSchema),
  updateTaskStatus,
);
router.delete('/:taskId', validateObjectId('taskId'), deleteTask);

export default router;
