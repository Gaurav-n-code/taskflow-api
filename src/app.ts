import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'TaskFlow API is running' });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId/tasks', taskRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
