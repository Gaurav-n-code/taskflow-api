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

  it('updating the title preserves the existing priority', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Initial Title', priority: 'high', description: 'Initial Desc' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.description).toBe('Initial Desc');

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.body.data.priority).toBe('high');
    expect(getRes.body.data.description).toBe('Initial Desc');
  });

  it('updating the priority preserves the existing title', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Fixed Title', priority: 'low' });
    const taskId = createRes.body.data._id as string;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.title).toBe('Fixed Title');

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.body.data.title).toBe('Fixed Title');
  });

  it('two concurrent partial updates to different fields preserve both changes without lost updates', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Prepare release', priority: 'low', description: 'Original description' });
    const taskId = createRes.body.data._id as string;

    // Issue two concurrent atomic PATCH requests simultaneously
    const [resA, resB] = await Promise.all([
      request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Prepare v2 release' }),
      request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ priority: 'high' }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Fetch the final document from DB to verify both concurrent updates survived
    const finalRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.title).toBe('Prepare v2 release');
    expect(finalRes.body.data.priority).toBe('high');
    expect(finalRes.body.data.description).toBe('Original description');
  });

  it('omitted fields are not reset to defaults or overwritten by stale values', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Original', description: 'Important context', priority: 'high' });
    const taskId = createRes.body.data._id as string;

    // Only update description
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ description: 'Updated context' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Original');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.description).toBe('Updated context');
  });

  it('attempts to modify server-controlled fields (_id, createdBy, projectId) are ignored and do not alter document', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Security Task', priority: 'medium' });
    const taskId = createRes.body.data._id as string;
    const originalCreatedBy = createRes.body.data.createdBy;
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        title: 'Safe Title',
        _id: fakeId,
        createdBy: fakeId,
        projectId: fakeId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(taskId);
    expect(res.body.data.title).toBe('Safe Title');

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.body.data._id).toBe(taskId);
    expect(getRes.body.data.createdBy._id).toBe(originalCreatedBy);
    expect(getRes.body.data.projectId).toBe(projectId);
  });

  it('validation errors do not persist invalid changes', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Valid Task', priority: 'medium' });
    const taskId = createRes.body.data._id as string;

    // Send invalid priority and title simultaneously
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ priority: 'ultra-high' });

    expect(res.status).toBe(400);

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(getRes.body.data.priority).toBe('medium');
    expect(getRes.body.data.title).toBe('Valid Task');
  });

  it('missing task produces 404 response on update', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${fakeId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('existing project authorization rules continue to apply', async () => {
    const bob = await registerAndLogin({
      name: 'Bob Outsider',
      email: 'bob.out@test.com',
      password: 'password123',
    });

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Alice Task' });
    const taskId = createRes.body.data._id as string;

    // Bob is not a member of Alice's project
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Bob Hijack' });

    expect(res.status).toBe(403);
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
