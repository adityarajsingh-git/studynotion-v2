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
- 🌱 Seed script — demo instructor, categories and courses in one command

See [ROADMAP.md](./ROADMAP.md) for what's landing next — this repo is in active development.

## Run it locally

**Prereqs:** Node 18+, a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
# 1. API
cd server
cp .env.example .env        # fill MONGODB_URL and JWT_SECRET
npm install
npm run seed                # demo data (instructor@demo.test / demo1234)
npm run dev                 # http://localhost:4000

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

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
