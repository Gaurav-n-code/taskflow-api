import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { User } from '../models/User';

const app = createApp();

const TEST_USER = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  password: 'password123',
};

beforeAll(async () => {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/taskflow-test';
  await mongoose.connect(uri);
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 409 when email is already registered', async () => {
    await request(app).post('/api/auth/register').send(TEST_USER);
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(TEST_USER);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  let token: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    token = res.body.data.token as string;
  });

  it('returns the current user profile', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_USER.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
