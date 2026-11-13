# StudyNotion v2 — Roadmap

Rebuilding in public, one commit at a time. `(owner)` marks items that need a
secret, a paid service or an owner decision.

## Shipped
- Monorepo: Vite + React + TS client, Express + TS server
- Auth: signup/login/me, bcrypt, JWT, role guards, rate limiting, helmet
- Catalog with search + category filter, course details, enroll, dashboard
- Instructor course builder: create/edit form, draft/publish, delete guard,
  lesson CRUD + reorder, role-aware dashboard with student counts
- Seed script, env examples, central error handling, deploy docs
- Server + client test suites, separate server typecheck gate

## Learner experience
- [x] Course page shows an "enrolled" state (link to dashboard) instead of an Enroll button when the user already owns the course
- [x] Catalog search waits for a short pause in typing instead of querying on every keystroke
- [x] Catalog loading state does not flash the empty message (already shipped), and the error panel has a Retry button
- [ ] Course page error state has a "Back to catalog" link and a Retry button
- [ ] Lesson completion tracking: user can mark lessons done and see progress % per course
- [ ] Course player page with previous/next lesson navigation (needs lesson content model first)
- [ ] Ratings & reviews: model, endpoints, UI

## Reliability and accessibility
- [ ] Document title updates per page (catalog, course title, dashboard)
- [ ] Form errors are announced (`role="alert"`) and inputs have associated labels on login/signup
- [ ] Expired token mid-session sends the user to login with a "session expired" message

## Docs and quality
- [ ] README test counts and project structure match the current code
- [ ] CI workflow running both packages' build + tests (owner)
- [ ] ESLint + Prettier config (owner)

## Payments and media (owner)
- [ ] Razorpay test-mode checkout for enrollment (owner)
- [ ] Payment emails via Nodemailer (owner)
- [ ] Cloudinary thumbnail upload (owner)
- [ ] Deploy to Netlify/Render/Atlas, README screenshots and live demo link (owner)
