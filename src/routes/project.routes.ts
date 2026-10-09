import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../validation/validate';
import { validateObjectId } from '../middleware/validateObjectId';
import { createProjectSchema, addMemberSchema } from '../validation/project.schemas';
import {
  createProject,
  listProjects,
  getProject,
  addMember,
} from '../controllers/project.controller';

const router = Router();

router.use(authenticate);

router.post('/', validate(createProjectSchema), createProject);
router.get('/', listProjects);
router.get('/:projectId', validateObjectId('projectId'), getProject);
router.post(
  '/:projectId/members',
  validateObjectId('projectId'),
  validate(addMemberSchema),
  addMember,
);

export default router;
