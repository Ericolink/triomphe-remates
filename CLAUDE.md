# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Triomphe Remates** is a Mexican bank-auction (remates bancarios) real estate platform. It has a public-facing property browser and a private admin panel. The domain matters: properties have `auctionDate`, legal acquisition stages, and "PENDIENTE" pricing (null = price not yet set).

## Commands

### Development (run each in its own terminal)

```bash
# Backend
cd server && npm run dev        # nodemon on port 3001

# Frontend
cd client && npm run dev        # Vite on port 5173
```

### Build & Lint

```bash
# Full production build (output goes to server/client/)
npm run build                   # from repo root

# Lint
cd server && npm run lint
cd client && npx eslint src/

# Format
cd server && npm run format
```

### Environment Setup

```bash
cp server/.env.example server/.env   # then fill in DB, JWT, Cloudinary, Gmail creds
cp client/.env.example client/.env   # VITE_API_URL=http://localhost:3001/api
```

The server needs MySQL running locally (`triomphe_db`). Sequelize runs `sync({ alter: false })` on startup — schema changes require manual migrations or temporarily switching to `alter: true`.

## Architecture

### Monorepo Layout

```
/
├── server/          Node.js/Express API + serves compiled frontend
│   ├── server.js    Entry: boots Sequelize sync then Express
│   ├── app.js       Routes, CORS, rate limiting, static file serving
│   ├── config/      db.js (Sequelize), swagger.js
│   └── src/
│       ├── controllers/   Business logic (one file per resource)
│       ├── models/        Sequelize models + index.js (associations)
│       ├── routes/        Express routers
│       ├── middleware/     authMiddleware, roleMiddleware, uploadMiddleware, rateLimitMiddleware
│       ├── services/       emailService.js (all transactional email)
│       └── utils/          audit.js (logAudit helper), helpers.js (generateSlug)
└── client/          React SPA (Vite)
    └── src/
        ├── App.jsx          Routes — all pages use React.lazy() + single <Suspense>
        ├── pages/public/    Public-facing pages
        ├── pages/admin/     Admin panel pages (lazy-loaded, not shipped to anonymous users)
        ├── components/
        │   ├── layout/      PublicLayout, AdminLayout, Navbar, Footer
        │   └── ui/          Reusable components (PropertyCard, Badge, Lightbox, etc.)
        ├── hooks/           useFavorites, useComparator, useNotifications (all Zustand-backed)
        ├── store/           authStore.js, themeStore.js (Zustand)
        ├── services/        One file per API resource, all use the shared api.js axios instance
        └── utils/
            ├── animations.js   Framer Motion variant objects (reuse these, don't create new ones)
            ├── constants.js    CITY_LABELS, TYPE_LABELS, STATUS_LABELS, STATUS_VARIANTS
            ├── formatters.js   formatPrice, formatDate, formatDateTime
            └── images.js       buildImageUrl(url, width) — injects Cloudinary transforms
```

### Deployment

Hosted exclusively on **SmarterASP.NET** as a Node.js app running under IIS via `httpPlatformHandler` (not ASP.NET Core). `npm run build` (root) compiles the React app into `server/client/`, then `npm start` (`node server/server.js`) boots Express, which serves both the API and the compiled frontend. Deploys are manual: build locally, then FTP-upload `server/` (including the compiled `server/client/`) plus `web.config` to the SmarterASP webroot. `web.config` (repo root) is the clean IIS/httpPlatformHandler template — the real `server/web.config` with production secrets is gitignored and lives only on the deploy target; never commit it. SmarterASP has no native env-var panel — production env vars are injected via the `<environmentVariables>` block inside `web.config` itself (not `server/.env` — that file is a local-dev convenience only and is never read on SmarterASP if the IIS env vars are set). See `AUDITORIA_SMARTERASP_DEPLOY.md` for the full deploy checklist.

**`server/` is the exact folder that gets uploaded by FTP — never leave backups, dumps, or one-off admin/diagnostic scripts sitting inside it**, even gitignored ones: git-ignored just means "not committed," not "excluded from the FTP payload." `npm run build` runs a `postbuild` gate (`scripts/check-deploy-safety.js`) that fails the build if it finds `*.tar.gz`, `*.backup`, `*.bak`, `*.sql`, or known one-off scripts (`update-admin.js`, `version-check*.js`) inside `server/`. If you need a throwaway script or a DB dump while working, put it outside the repo (e.g. `~/backups/triomphe/`) or in a path already excluded from the build tree, and run `npm run predeploy:check` manually right before FTP-uploading as a final check.

### Auth Flow

JWT stored in `localStorage`. The `api.js` axios instance auto-attaches the `Authorization: Bearer` header. Server middleware chain for protected routes: `authenticate` (validates JWT, attaches `req.user`) → optionally `authorize('admin')` (role check).

**401 handling is centralized in `api.js`'s response interceptor and driven by a `code` field, not by status alone.** Not every 401 means "session expired" — `PUT /auth/change-password` and `PUT /users/:id` (self password change) also return 401 for "current password incorrect," a business rejection where the token is still valid. The backend distinguishes these with `ApiError`'s optional `code` (`server/src/middleware/errorHandler.js`): `authMiddleware.authenticate` always responds `401 { code: 'INVALID_SESSION' }` for a missing/invalid/expired token or stale `tokenVersion`; `authController.changePassword` and `usersController.updateUser` respond `401 { code: 'INVALID_CURRENT_PASSWORD' }` for a wrong current password. The interceptor clears storage and redirects to `/admin/login` for any 401 *except* codes in its `NON_SESSION_401_CODES` set — this is the only place in the frontend that makes this decision; components must not duplicate it (e.g. by comparing `error` message text) and must not need a per-call escape hatch to opt out of the redirect.

**Rate limiting** (`server/src/middleware/rateLimitMiddleware.js`): `authLimiter` (20/15min, keyed by IP) guards `POST /auth/login` and `POST /auth/register` — anonymous credential-guessing surface, IP is the only signal available. `PUT /auth/change-password` uses its own `changePasswordLimiter` (10/15min, keyed by the JWT's user id via `jwt.verify`, falling back to IP if the token is missing/invalid) instead — it's an already-authenticated action where the relevant attacker already holds a token, so the limit is anchored to the account being attacked rather than shared with anonymous login traffic from the same IP/NAT. Everything else authenticated goes through `apiLimiter` (500/15min, second layer behind `authenticate`/`authorize`); public conversion forms (leads/feedback/postulaciones) use `publicFormLimiter` (20/15min) — a separate instance from `authLimiter` so login traffic never starves form submissions or vice versa.

Two roles: `admin` (full access) and `editor` (limited — AuditPage is admin-only).

### Real-time Notifications

Leads trigger SSE events to connected admin clients. `leadController.js` maintains an in-memory `Set` of SSE response objects. When a lead is created, it broadcasts to all connected clients. The client hook `useNotifications` opens the EventSource with the JWT in the query string (EventSource doesn't support custom headers).

### Image Pipeline

Images are uploaded via `uploadMiddleware` (multer memoryStorage, 5MB limit, jpg/png/webp only) → `propertyController` streams the buffer to Cloudinary under `triomphe/properties/`. All image URLs stored in the `images` table are full Cloudinary URLs. Always use `buildImageUrl(url, width)` from `utils/images.js` when rendering — it injects `f_auto,q_auto,c_limit,w_<width>` Cloudinary transforms. Never render raw Cloudinary URLs directly.

### Email

All transactional email goes through `server/src/services/emailService.js` via Gmail/Nodemailer. The `buildEmail({ title, subtitle, badge, body, cta, footerNote })` helper generates the branded HTML template. Add new email types by calling `buildEmail` and `transporter.sendMail` — don't build HTML strings inline.

### Shared State (Frontend)

`useFavorites` and `useComparator` are Zustand stores (not `useState`) — this is intentional so the Navbar badge, individual buttons, and list pages all react to the same state. Do not revert these to `useState` or the badge will fall out of sync.

### Key Conventions

- **Labels/formatting**: Import from `utils/constants.js` (`CITY_LABELS`, `TYPE_LABELS`, etc.) and `utils/formatters.js` (`formatPrice`, `formatDate`, `formatDateTime`). Never define these inline in a component.
- **Animations**: Use variants from `utils/animations.js` (`fadeInUp`, `staggerContainer`, etc.) with `whileInView` + `viewport={{ once: true }}` for scroll-triggered animations.
- **`null` price = "PENDIENTE"**: Properties can have `price: null` meaning the auction price is not yet confirmed. `formatPrice(null)` returns `'PENDIENTE'`. This is domain-specific — don't treat it as an error.
- **DB schema changes**: `server/migrations/` (Sequelize CLI, `npm run migrate`) is the single source of truth for schema evolution — every new column/table is a migration there, never a hand-edited `ALTER TABLE`. `sequelize.sync({ alter: false })` in `server.js` only bootstraps tables for a genuinely empty database from the current models; it never alters existing tables. `checkPendingMigrations` (`server/src/config/checkPendingMigrations.js`) runs at every startup and aborts (`process.exit(1)`) if this database's `SequelizeMeta` is missing migrations that exist on disk — this is what prevents the schema-drift class of incident from going silent. On first boot against a brand-new database it auto-stamps all existing migration files as applied (since `sync()` already built the current schema) instead of re-running them.
- **Audit logging**: Call `logAudit(req, action, resource, resourceId, detail)` from `utils/audit.js` whenever an admin mutates data. Actions: `create`, `update`, `delete`, `export`. Resources: `property`, `lead`, `feedback`, `user`, `job`, `alert`.
