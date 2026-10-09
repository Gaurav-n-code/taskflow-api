# TaskFlow API

A lightweight, production-style task management REST API built with Node.js, TypeScript, Express, and MongoDB.

## Features

- User registration and JWT authentication
- Project management with member access control
- Task creation, assignment, filtering, pagination, and status updates
- Strict TypeScript, Zod validation, and centralized error handling

## Prerequisites

- Node.js >= 18
- npm >= 9
- MongoDB 6+ (local, Docker, or Atlas)

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd taskflow-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Start MongoDB (Docker)

```bash
docker-compose up -d
```

### 4. Run in development mode

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## Environment Variables

| Variable         | Required | Default                              | Description                       |
| ---------------- | -------- | ------------------------------------ | --------------------------------- |
| `PORT`           | No       | `3000`                               | Server port                       |
| `NODE_ENV`       | No       | `development`                        | Runtime environment               |
| `MONGODB_URI`    | No       | `mongodb://localhost:27017/taskflow` | MongoDB connection string         |
| `JWT_SECRET`     | **Yes**  | —                                    | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | No       | `7d`                                 | JWT expiry duration               |
| `BCRYPT_ROUNDS`  | No       | `12`                                 | bcrypt cost factor                |

## npm Scripts

| Script           | Description                               |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Start development server with live reload |
| `npm run build`  | Compile TypeScript to `dist/`             |
| `npm start`      | Run the compiled build                    |
| `npm test`       | Run Jest test suite                       |
| `npm run lint`   | Run ESLint                                |
| `npm run format` | Format code with Prettier                 |

## API Endpoints

### Health

| Method | Path      | Auth | Description          |
| ------ | --------- | ---- | -------------------- |
| GET    | `/health` | No   | Service health check |

### Authentication

| Method | Path                 | Auth | Description              |
| ------ | -------------------- | ---- | ------------------------ |
| POST   | `/api/auth/register` | No   | Register a new user      |
| POST   | `/api/auth/login`    | No   | Login and receive JWT    |
| GET    | `/api/auth/me`       | Yes  | Get current user profile |

### Projects

| Method | Path                               | Auth        | Description                 |
| ------ | ---------------------------------- | ----------- | --------------------------- |
| POST   | `/api/projects`                    | Yes         | Create a new project        |
| GET    | `/api/projects`                    | Yes         | List projects you belong to |
| GET    | `/api/projects/:projectId`         | Yes         | Get a project by ID         |
| POST   | `/api/projects/:projectId/members` | Yes (owner) | Add a member to a project   |

### Tasks

| Method | Path                                            | Auth | Description            |
| ------ | ----------------------------------------------- | ---- | ---------------------- |
| POST   | `/api/projects/:projectId/tasks`                | Yes  | Create a task          |
| GET    | `/api/projects/:projectId/tasks`                | Yes  | List tasks (paginated) |
| GET    | `/api/projects/:projectId/tasks/:taskId`        | Yes  | Get a task by ID       |
| PATCH  | `/api/projects/:projectId/tasks/:taskId`        | Yes  | Update task fields     |
| PATCH  | `/api/projects/:projectId/tasks/:taskId/status` | Yes  | Update task status     |
| DELETE | `/api/projects/:projectId/tasks/:taskId`        | Yes  | Delete a task          |

#### Task listing query parameters

| Parameter  | Type    | Description                                          |
| ---------- | ------- | ---------------------------------------------------- |
| `page`     | integer | Page number (default: 1)                             |
| `limit`    | integer | Items per page (default: 20, max: 100)               |
| `status`   | string  | Filter by status: `todo`, `in_progress`, `completed` |
| `priority` | string  | Filter by priority: `low`, `medium`, `high`          |

## Example Requests

### Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "secret123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "secret123"}'
```

### Create a project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name": "My Project", "description": "A sample project"}'
```

### Create a task

```bash
curl -X POST http://localhost:3000/api/projects/<projectId>/tasks \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"title": "Fix login bug", "priority": "high"}'
```

### List tasks with filters

```bash
curl "http://localhost:3000/api/projects/<projectId>/tasks?page=1&limit=10&priority=high&status=todo" \
  -H 'Authorization: Bearer <token>'
```

## Authorization Policy

- **Project access**: Users can only access projects where they are the owner or a member.
- **Adding members**: Only the project owner can add new members.
- **Task creation & viewing**: Any project member can view and create tasks within their projects. Assignees must be members of the project.
- **Task updates**: Only the project owner, the task creator, or the assigned member can update a task or its status. Ownership (creator/project) cannot be altered.
- **Task deletion**: Only the project owner or the task creator can delete a task.

## Error Responses

All errors follow a consistent JSON shape:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [{ "field": "body.email", "message": "Invalid email" }]
}
```

Stack traces are never returned in production.

## Project Structure

```
src/
├── __tests__/          # Integration tests
├── config/             # App config and database connection
├── controllers/        # Route handlers (thin, delegate to services)
├── middleware/         # Auth, error handler, ObjectId validation
├── models/             # Mongoose models
├── routes/             # Express routers
├── services/           # Business logic
├── types/              # Shared TypeScript types
├── validation/         # Zod schemas and validate middleware
├── app.ts              # Express app factory
└── server.ts           # Entry point
```
