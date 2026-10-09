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
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
    expect(res.body.pagination.totalPages).toBe(1);
    expect(res.body.pagination.hasNextPage).toBe(false);
    expect(res.body.pagination.hasPrevPage).toBe(false);
    expect(res.body.data).toHaveLength(2);
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

  describe('Pagination regression tests', () => {
    beforeEach(async () => {
      // Clear and create 5 distinct tasks with sequential creation dates
      await Task.deleteMany({});
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            title: `Task ${i}`,
            priority: i % 2 === 0 ? 'high' : 'low',
            status: i <= 3 ? 'todo' : 'completed',
          });
      }
    });

    it('returns page 1 starting at offset 0 without skipping items', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=1&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].title).toBe('Task 5'); // sorted by createdAt desc
      expect(res.body.data[1].title).toBe('Task 4');
      expect(res.body.pagination).toEqual({
        total: 5,
        page: 1,
        limit: 2,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('returns page 2 with next records without overlap or skipped records', async () => {
      const page1Res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=1&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      const page2Res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=2&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data).toHaveLength(2);
      expect(page2Res.body.data[0].title).toBe('Task 3');
      expect(page2Res.body.data[1].title).toBe('Task 2');
      expect(page2Res.body.pagination).toEqual({
        total: 5,
        page: 2,
        limit: 2,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });

      // Assert no overlap between page 1 and page 2
      const page1Ids = page1Res.body.data.map((t: { _id: string }) => t._id);
      const page2Ids = page2Res.body.data.map((t: { _id: string }) => t._id);
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('returns the last page with remaining items and correct metadata', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=3&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Task 1');
      expect(res.body.pagination).toEqual({
        total: 5,
        page: 3,
        limit: 2,
        totalPages: 3,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('returns empty results when page exceeds total pages', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=4&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination).toEqual({
        total: 5,
        page: 4,
        limit: 2,
        totalPages: 3,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('handles pagination correctly when result set is empty', async () => {
      await Task.deleteMany({});
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=1&limit=20`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('combines pagination with status and priority filters', async () => {
      // 5 tasks: Task 1 (low, todo), Task 2 (high, todo), Task 3 (low, todo), Task 4 (high, completed), Task 5 (low, completed)
      // Filter status=todo -> Tasks 1, 2, 3 (total: 3)
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?status=todo&page=1&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].title).toBe('Task 3');
      expect(res.body.data[1].title).toBe('Task 2');
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
      expect(res.body.pagination.hasNextPage).toBe(true);

      const page2Res = await request(app)
        .get(`/api/projects/${projectId}/tasks?status=todo&page=2&limit=2`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data).toHaveLength(1);
      expect(page2Res.body.data[0].title).toBe('Task 1');
      expect(page2Res.body.pagination.hasNextPage).toBe(false);
      expect(page2Res.body.pagination.hasPrevPage).toBe(true);
    });

    describe('Query parameter validation', () => {
      it('rejects page = 0 with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?page=0`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects negative page with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?page=-1`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects non-integer page with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?page=1.5`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects non-numeric string page with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?page=abc`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects limit = 0 with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?limit=0`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects negative limit with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?limit=-5`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects non-integer limit with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?limit=2.5`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('rejects limit exceeding maximum 100 with 400', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?limit=101`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('accepts limit = 100 with 200', async () => {
        const res = await request(app)
          .get(`/api/projects/${projectId}/tasks?limit=100`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(100);
      });
    });
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
