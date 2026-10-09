import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Task } from '../models/Task';

const app = createApp();

async function registerAndLogin(data: { name: string; email: string; password: string }) {
  const res = await request(app).post('/api/auth/register').send(data);
  return res.body.data as { token: string; user: { id: string } };
}

let aliceToken: string;
let projectId: string;

beforeAll(async () => {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/taskflow-test';
  await mongoose.connect(uri);
});

beforeEach(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});

  const alice = await registerAndLogin({
    name: 'Alice',
    email: 'alice@test.com',
    password: 'password123',
  });
  aliceToken = alice.token;

  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ name: 'Test Project', description: 'For task tests' });
  projectId = projectRes.body.data._id as string;
});

afterAll(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});
  await mongoose.disconnect();
});

describe('POST /api/projects/:projectId/tasks', () => {
  it('creates a task in a project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'First Task', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('First Task');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.status).toBe('todo');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ priority: 'medium' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'No Auth Task' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when a non-member creates a task', async () => {
    const bob = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Bob Task' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/projects/:projectId/tasks', () => {
  beforeEach(async () => {
    // Create some tasks
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Task One', priority: 'high' });
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Task Two', priority: 'low', status: 'in_progress' });
  });

  it('lists tasks with pagination metadata', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters tasks by priority', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?priority=high`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { priority: string }) => t.priority === 'high')).toBe(true);
  });

  it('filters tasks by status', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?status=in_progress`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { status: string }) => t.status === 'in_progress')).toBe(true);
  });
});

describe('GET /api/projects/:projectId/tasks/:taskId', () => {
  it('returns a specific task by id', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Specific Task' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(taskId);
    expect(res.body.data.title).toBe('Specific Task');
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${fakeId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/projects/:projectId/tasks/:taskId', () => {
  it('updates allowed task fields', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Old Title', priority: 'low' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'New Title', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('New Title');
    expect(res.body.data.priority).toBe('high');
  });

  it('returns 400 for an invalid priority value', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'A Task' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ priority: 'critical' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/projects/:projectId/tasks/:taskId/status', () => {
  it('allows valid transition from todo -> in_progress', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Task to Progress', status: 'todo' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');

    // Verify persisted in DB
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.body.data.status).toBe('in_progress');
  });

  it('allows valid transition from in_progress -> completed', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Task to Complete', status: 'in_progress' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });

  it('rejects invalid transition from todo -> completed with 400 and preserves state', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Todo Task', status: 'todo' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid status transition');

    // Verify task state unchanged in DB
    const checkRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(checkRes.body.data.status).toBe('todo');
  });

  it('rejects transitions out of completed (terminal status) with 400 and preserves state', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Completed Task', status: 'completed' });
    const taskId = createRes.body.data._id as string;

    // Try completed -> in_progress
    const res1 = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'in_progress' });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // Try completed -> todo
    const res2 = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'todo' });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);

    // Verify task status still completed
    const checkRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(checkRes.body.data.status).toBe('completed');
  });

  it('rejects repeated/same-state transitions (e.g., todo -> todo, in_progress -> in_progress)', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Todo Task', status: 'todo' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'todo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects backwards transition from in_progress -> todo', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'In Progress Task', status: 'in_progress' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'todo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects unsupported status values (e.g. "archived", "cancelled", random string) with 400', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Test Task' });
    const taskId = createRes.body.data._id as string;

    const res1 = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'archived' });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    const res2 = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'random_status' });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });

  it('rejects empty or missing status in payload with 400', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Test Task' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when updating status for a non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${fakeId}/status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
  it('deletes a task successfully', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'To Be Deleted' });
    const taskId = createRes.body.data._id as string;

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Protected Task' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app).delete(`/api/projects/${projectId}/tasks/${taskId}`);
    expect(res.status).toBe(401);
  });
});

describe('Health check', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
