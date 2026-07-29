# CLAUDE.md

StudyNotion v2 — an ed-tech platform. Monorepo with two **independent** npm packages: `server/`
(Express + TypeScript + Mongoose) and `client/` (Vite + React 18 + TS + Redux Toolkit + Tailwind).
There is no root `package.json`/workspace — install and run each package separately.

## Commands
```bash
# server/  (API)
npm run dev        # tsx watch on src/index.ts (port 4000)
npm run seed       # wipe + load demo data; needs MONGODB_URL (instructor@demo.test / demo1234)
npm run typecheck  # tsc -p tsconfig.test.json — type-checks tests AND src/ (there is no lint script)
npm test           # vitest run — real routes over in-memory MongoDB (no .env/Atlas needed)
npm run build      # tsc -> dist/

# client/  (SPA)
npm run dev        # vite (port 5173; proxies /api -> localhost:4000)
npm test           # vitest run (jsdom + Testing Library)
npm run build      # tsc -b && vite build — also the client's only typecheck (no typecheck script)

# run a single test file / name (either package)
npm test -- courses.test.ts        # one file (path substring)
npm test -- -t "rejects bad login" # one test/describe by name
```

## Architecture (the parts that span files)
- **Request flow (server):** `routes → controllers → models`. Every async controller is wrapped in
  `asyncHandler` (`utils/asyncHandler.ts`) so thrown/rejected errors reach the single
  `errorHandler` (`middleware/error.ts`), which maps Mongoose `ValidationError`/`CastError`→400 and
  duplicate-key `11000`→409. Controllers can safely let DB errors bubble; don't add try/catch for them.
- **App vs. server split:** `app.ts` exports `createApp()` (no `listen`, no DB); `index.ts` connects
  the DB and listens. Tests import `createApp()` and drive it with `supertest` — keep them separate.
- **Auth:** `requireAuth` reads a `Bearer` token and sets `req.user = { id, role }`; `requireRole("instructor")`
  guards create endpoints (courses, categories). Tokens are signed 7d in `utils/jwt.ts`. The User
  `password` field is `select:false` — you must `.select("+password")` to read it (see login).
- **API contract:** every response is `{ success, ... }` or `{ success:false, message }`. The client's
  `request<T>()` (`client/src/lib/api.ts`) throws on `!res.ok` **or** `success:false`. All routes live
  under `/api/v2/*`. Signup/login/me deliberately return the **identical** user shape via `serializeUser`
  (with `enrolledCourses` populated) — the client depends on this invariant, so keep them in sync.
- **Client state:** one Redux Toolkit `auth` slice. `bootSession` runs once on `App` mount to hydrate
  the user from the `sn2_token` in localStorage; the `booted` flag gates `ProtectedRoute` (renders
  "Loading…" until boot finishes, then redirects if signed out). After a server-side change (e.g.
  enroll), dispatch `refreshUser`.

## Conventions & gotchas
- Server runs fine **without** `MONGODB_URL` (it warns, DB routes then fail) — copy `server/.env.example`
  to `server/.env` and set `MONGODB_URL` + `JWT_SECRET` for anything real.
- Tailwind uses custom design tokens: `cream`, `panel`, `edge`, `amber`. Courses show CSS-color
  thumbnails (`thumbnailColor`) — real media upload is intentionally not built yet.
- Tests: server tests in `server/tests/` use `helpers.ts` (`makeUser` hits the real signup route,
  `auth(token)`, `makeCourse`). Client tests are colocated `*.test.tsx` and use `renderWithProviders`
  + `aUser`/`aCourse` factories from `src/test/utils.tsx`; mock the `api` object with `vi.spyOn`.
- Some features are stubs by design (see `ROADMAP.md`): enroll returns a "Week 3" message, no payments,
  no course builder yet. Don't "fix" these placeholders unless the task is that roadmap item.

## Project rules
- Personal project. Commit identity adityarajsingh.code@gmail.com (already set via git includeIf on ~/personal/)
- Run tests in BOTH packages before any commit
- One logical change per commit
- Never add dependencies without asking me first
- Never commit .env or any secret

## Git conventions
- Branch: `<type>/<short-kebab-description>` — types: feat, fix, chore, refactor, test, docs, ci
- Lowercase, kebab-case, 2-4 words, describes the change not the file
- Never auto-generate branch names — ask me if unclear
- Examples: fix/regex-injection, feat/course-builder, chore/security-headers
- Commit messages: conventional commits, e.g. fix(server): escape regex metacharacters in course search
