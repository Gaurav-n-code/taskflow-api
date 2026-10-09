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

  describe('Task-level authorization on PATCH', () => {
    let memberToken: string;
    let otherMemberToken: string;
    let outsiderToken: string;
    let otherProjectId: string;

    beforeEach(async () => {
      // Bob is added to Alice's project
      const bob = await registerAndLogin({
        name: 'Bob Member',
        email: 'bob.member@test.com',
        password: 'password123',
      });
      memberToken = bob.token;
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: bob.user.id });

      // Charlie is also added to Alice's project
      const charlie = await registerAndLogin({
        name: 'Charlie Member',
        email: 'charlie.member@test.com',
        password: 'password123',
      });
      otherMemberToken = charlie.token;
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: charlie.user.id });

      // David is an outsider with his own project
      const david = await registerAndLogin({
        name: 'David Outsider',
        email: 'david.outsider@test.com',
        password: 'password123',
      });
      outsiderToken = david.token;

      const otherProjRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ name: 'David Project' });
      otherProjectId = otherProjRes.body.data._id as string;
    });

    it('allows task creator (project member) to update their task', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Task" });
      const taskId = createRes.body.data._id as string;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Updated Task" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Bob's Updated Task");
    });

    it('allows project owner to update any task in their project', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Task" });
      const taskId = createRes.body.data._id as string;

      // Alice is project owner
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Owner Updated Bob Task' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Owner Updated Bob Task');
    });

    it('allows assignee to update task', async () => {
      const bobUser = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${memberToken}`);

      // Alice creates task assigned to Bob
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Task For Bob', assigneeId: bobUser.body.data.id });
      const taskId = createRes.body.data._id as string;

      // Bob (assignee) updates task
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Task Updated By Assignee' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Task Updated By Assignee');
    });

    it('rejects update by an unauthorized project member with 403', async () => {
      // Bob creates a task
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Private Task" });
      const taskId = createRes.body.data._id as string;

      // Charlie is a member of the same project, but not creator, owner, or assignee
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${otherMemberToken}`)
        .send({ title: 'Hacked by Charlie' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects update by a user from another project with 403', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: "Alice's Task" });
      const taskId = createRes.body.data._id as string;

      // David tries to access Alice's project task
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'David update' });

      expect(res.status).toBe(403);
    });

    it('returns 404 when taskId does not exist in the project for authorized user', async () => {
      const fakeTaskId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${fakeTaskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Non-existent' });

      expect(res.status).toBe(404);
    });

    it('returns 404 when accessing a task with wrong projectId', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: "Alice's Task" });
      const taskId = createRes.body.data._id as string;

      // Alice tries to access her task using David's project ID (where she is not a member -> 403)
      const res = await request(app)
        .patch(`/api/projects/${otherProjectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Mismatch' });

      expect(res.status).toBe(404);
    });

    it('rejects assigning task to a non-project member with 400', async () => {
      const davidUser = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${outsiderToken}`);

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Task to assign' });
      const taskId = createRes.body.data._id as string;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ assigneeId: davidUser.body.data.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('member');
    });

    it('allows unassigning a task (assigneeId: null)', async () => {
      const bobUser = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${memberToken}`);

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Assigned Task', assigneeId: bobUser.body.data.id });
      const taskId = createRes.body.data._id as string;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ assigneeId: null });

      expect(res.status).toBe(200);
      expect(res.body.data.assigneeId).toBeUndefined();
    });
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

  describe('Task-level authorization on DELETE', () => {
    let memberToken: string;
    let otherMemberToken: string;
    let outsiderToken: string;

    beforeEach(async () => {
      // Bob is added to Alice's project
      const bob = await registerAndLogin({
        name: 'Bob Member',
        email: 'bob.del@test.com',
        password: 'password123',
      });
      memberToken = bob.token;
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: bob.user.id });

      // Charlie is also added to Alice's project
      const charlie = await registerAndLogin({
        name: 'Charlie Member',
        email: 'charlie.del@test.com',
        password: 'password123',
      });
      otherMemberToken = charlie.token;
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: charlie.user.id });

      // David is an outsider
      const david = await registerAndLogin({
        name: 'David Outsider',
        email: 'david.del@test.com',
        password: 'password123',
      });
      outsiderToken = david.token;
    });

    it('allows task creator to delete their own task', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Task to Delete" });
      const taskId = createRes.body.data._id as string;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows project owner to delete any task in the project', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Task" });
      const taskId = createRes.body.data._id as string;

      // Alice (project owner) deletes Bob's task
      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects delete by an unauthorized project member with 403', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Bob's Protected Task" });
      const taskId = createRes.body.data._id as string;

      // Charlie (member, not creator or owner) tries to delete
      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${otherMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects delete by an assignee who is neither creator nor owner with 403', async () => {
      const bobUser = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${memberToken}`);

      // Alice creates a task assigned to Bob
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: 'Task assigned to Bob', assigneeId: bobUser.body.data.id });
      const taskId = createRes.body.data._id as string;

      // Bob (assignee, not creator or owner) tries to delete
      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects delete by a user from another project with 403', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ title: "Alice's Task" });
      const taskId = createRes.body.data._id as string;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 when deleting a non-existent task for authorized user', async () => {
      const fakeTaskId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${fakeTaskId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('Health check', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
