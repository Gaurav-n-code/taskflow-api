import { Router } from 'express';
import { validate } from '../validation/validate';
import { registerSchema, loginSchema } from '../validation/auth.schemas';
import { register, login, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, me);

export default router;
