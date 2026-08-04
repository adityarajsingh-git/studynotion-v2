<h1 align="center">StudyNotion v2 🎓</h1>
<p align="center"><b>Learn. Build. Ship.</b> — an ed-tech platform rebuilt from an empty folder.</p>

---

## The story

I originally built StudyNotion while learning full-stack development through the CodeHelp (Love Babbar) MERN course, together with a team of four. **v2 is my ground-up rebuild**: new repo, new architecture, new stack — every file written from scratch, no code carried over.

**v1 → v2:**

| | v1 (course project) | v2 (this repo) |
|---|---|---|
| Frontend | CRA + JavaScript | **Vite + React 18 + TypeScript** |
| State | Redux | **Redux Toolkit** (typed slices/thunks) |
| Backend | Express + JS | **Express + TypeScript**, layered (routes → controllers → models) |
| Auth | JWT | JWT + role guards (student / instructor), typed middleware |
| API | mixed conventions | consistent `/api/v2/*`, central error handling, async wrappers |

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Redux Toolkit · React Router · Express · MongoDB (Mongoose) · JWT

## Features (today)

- 🔐 Auth — signup/login with hashed passwords, JWT sessions, role-based access (student/instructor)
- 📚 Catalog — courses with category filter + search, powered by query params
- 📄 Course pages — lessons, duration, instructor, enrollment
- 🧑‍🎓 Dashboard — profile + enrolled courses
- 🌱 Seed script — demo instructor + student, categories and courses in one command

See [ROADMAP.md](./ROADMAP.md) for what's landing next — this repo is in active development.

## Run it locally

**Prereqs:** Node 18+, a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
# 1. API
cd server
cp .env.example .env        # fill MONGODB_URL and JWT_SECRET
npm install
npm run seed                # demo data — see "Demo credentials" below
npm run dev                 # http://localhost:4000

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

## Demo credentials

`npm run seed` wipes existing data and creates two demo accounts:

| Role | Email | Password |
|---|---|---|
| Instructor | `instructor@demo.test` | `demo1234` |
| Student | `student@demo.test` | `demo1234` |

## Migration note

Upgrading from a pre-`status` deploy: courses created before the draft/published field have no `status` and won't appear in the catalog. Re-run `npm run seed`.

## Deployment

The client and API deploy separately — any static host + any Node host works.
The setup below is Netlify + Render, but nothing in the code depends on either.

**API — e.g. a [Render](https://render.com) web service:**

| Setting | Value |
|---|---|
| Root directory | `server/` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Env vars | `MONGODB_URL` (Atlas string) · `JWT_SECRET` (`openssl rand -hex 32`) · `CORS_ORIGIN` (your client URL) · `NODE_ENV=production` |

The server **refuses to boot** outside dev/test if `MONGODB_URL` or `JWT_SECRET`
is missing — a failed deploy beats a silently broken one. `PORT` is read from
the environment, so hosts that inject it need no extra config.

**Client — e.g. [Netlify](https://www.netlify.com):**

| Setting | Value |
|---|---|
| Base directory | `client/` |
| Build command | `npm run build` |
| Publish directory | `client/dist` |
| Env vars | `VITE_API_URL` — the API's public URL incl. prefix, e.g. `https://<your-api>.onrender.com/api/v2` |

`VITE_API_URL` is baked in at **build time** (Vite static replacement), so
changing it means rebuilding, not just redeploying. Left unset, the client
calls the same-origin `/api/v2` — which is exactly what local dev's proxy
expects, so no `.env` is needed for development.

Multiple allowed origins (say, production + a preview URL) are supported —
comma-separated, no spaces around commas:
`CORS_ORIGIN=https://site.netlify.app,https://preview.example.com`

## Tests

```bash
cd server && npm test     # 45 API tests — real routes against an in-memory MongoDB
cd client && npm test     # 68 tests — store, components, pages (Vitest + Testing Library)
```

The server suite boots a throwaway `mongodb-memory-server` per run and drives the
real Express app through `supertest`, so no `.env` or Atlas cluster is needed.
`npm run typecheck` in `server/` type-checks the tests alongside `src/`.

## Project structure

```
server/src
├── config/        env + db connection
├── models/        User · Category · Course
├── middleware/    auth (JWT + roles) · error handling
├── controllers/   auth · categories · courses
├── routes/        /api/v2/*
├── app.ts         express app (exported for tests)
└── seed.ts        demo data
server/tests       API integration tests

client/src
├── lib/api.ts     typed fetch layer
├── store/         Redux Toolkit (auth slice, session boot)
├── components/    Navbar · CourseCard · ProtectedRoute · Footer
└── pages/         Landing · Login · Signup · Catalog · CourseDetails · Dashboard
```

## Credits

Rebuild by [Adityaraj Singh](https://github.com/adityarajsingh-git). The original StudyNotion concept comes from the CodeHelp (Love Babbar) MERN course — v1 was built following that course with a team of four. v2 shares the idea, none of the code.

## License

[MIT](./LICENSE)
