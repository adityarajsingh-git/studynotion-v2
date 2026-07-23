# StudyNotion v2 — Roadmap

Rebuilding in public, one commit at a time. `git commit -m "better than yesterday"`

## ✅ Week 0 — Foundation (shipped)
- [x] Monorepo: Vite + React + TS client, Express + TS server
- [x] Auth: signup/login/me, bcrypt, JWT, role guards
- [x] Models: User, Category, Course (+ lessons)
- [x] Catalog with search + category filter, course details, enroll, dashboard
- [x] Seed script, env examples, central error handling

## 🔨 Week 1 — Course builder (instructor side)
- [ ] Create/edit course form (instructor dashboard tab)
- [ ] Section + lesson CRUD endpoints and UI
- [ ] Publish/draft states
- [ ] My-courses view with student counts

## 🔨 Week 2 — Learning experience
- [ ] Lesson completion tracking (progress % per course)
- [ ] Course player page with lesson navigation
- [ ] Ratings & reviews (model + endpoints + UI)
- [ ] Cloudinary media upload for thumbnails

## 🔨 Week 3 — Payments & polish
- [ ] Razorpay test-mode checkout for enrollment
- [ ] Payment success/failure emails (Nodemailer)
- [ ] Instructor income overview
- [ ] Empty/loading/error states audit

## 🔨 Week 4 — Ship
- [ ] Deploy: client on Netlify/Vercel, API on Render, DB on Atlas
- [ ] README screenshots + live demo link
- [ ] Lighthouse pass (a11y + perf)
- [ ] Announce: portfolio + LinkedIn post
