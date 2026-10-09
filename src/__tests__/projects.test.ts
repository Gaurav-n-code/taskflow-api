import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { User } from '../models/User';
import { Project } from '../models/Project';

const app = createApp();

async function registerAndLogin(data: { name: string; email: string; password: string }) {
  const res = await request(app).post('/api/auth/register').send(data);
  return res.body.data as { token: string; user: { id: string } };
}

beforeAll(async () => {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/taskflow-test';
  await mongoose.connect(uri);
});

afterEach(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /api/projects', () => {
  it('creates a project for an authenticated user', async () => {
    const { token } = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Project', description: 'A test project' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Project');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'No Auth Project' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const { token } = await registerAndLogin({
      name: 'Carol',
      email: 'carol@test.com',
      password: 'password123',
    });
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No name' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('returns only projects the user belongs to', async () => {
    const alice = await registerAndLogin({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    const bob = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Alice Project' });

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ name: 'Bob Project' });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Alice Project');
  });
});

describe('GET /api/projects/:projectId', () => {
  it('returns 403 when a non-member tries to access a project', async () => {
    const alice = await registerAndLogin({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    const bob = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Private Project' });

    const projectId = createRes.body.data._id as string;

    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid project ObjectId', async () => {
    const { token } = await registerAndLogin({
      name: 'Test',
      email: 'test@test.com',
      password: 'password123',
    });
    const res = await request(app)
      .get('/api/projects/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects/:projectId/members', () => {
  it('allows the owner to add a member', async () => {
    const alice = await registerAndLogin({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    const bob = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Team Project' });

    const projectId = createRes.body.data._id as string;

    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.user.id });

    expect(res.status).toBe(200);
  });

  it('returns 403 when a non-owner tries to add a member', async () => {
    const alice = await registerAndLogin({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    const bob = await registerAndLogin({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Alice Project' });
    const projectId = createRes.body.data._id as string;

    // Add Bob so he's a member, but not owner
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.user.id });

    // Now Bob tries to add someone else
    const carol = await registerAndLogin({
      name: 'Carol',
      email: 'carol@test.com',
      password: 'password123',
    });
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ userId: carol.user.id });

    expect(res.status).toBe(403);
  });
});
