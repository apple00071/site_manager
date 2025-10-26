# Authentication Flow

This document describes the rebuilt authentication implementation.

## Overview
- Client login via `POST /api/auth/login` with `email` and `password`.
- Server uses Supabase server client (`@supabase/ssr`) to authenticate and set cookies.
- Session managed by Supabase cookies; middleware guards protected routes.
- Logout via `POST /api/auth/logout` clears session.
- Session status via `GET /api/auth/session`.

## API Endpoints
- `POST /api/auth/login`
  - Request: `{ email: string, password: string }`
  - Responses:
    - `200`: `{ user }`
    - `400/401`: `{ error: string }`
- `POST /api/auth/logout`
  - Responses:
    - `200`: `{ success: true }`
    - `400`: `{ error: string }`
- `GET /api/auth/session`
  - Responses:
    - `200`: `{ authenticated: boolean, user?: object }`

## Routing & Security
- `middleware.ts` enforces:
  - Redirect unauthenticated users from protected routes to `/login`.
  - Redirect authenticated users away from `/login` and `/signup` to `/dashboard`.
  - Admin route protection via user metadata role.
- Static assets and API routes excluded via `matcher`.

## Login Page UI/UX
- Accessibility: labeled inputs, ARIA error descriptions.
- Validation: `zod` schema for email and password.
- Feedback: inline error messages, disabled submit during loading.
- Navigation: `router.replace('/dashboard')` on success.

## Testing
- Run `npm run test` to execute validation tests.
- Tests cover `LoginSchema` for email and password constraints.
- Extend tests to mock API routes as needed.

## Best Practices
- Use HTTPS in production to protect auth cookies.
- Rate-limit login endpoint at the platform level.
- Monitor auth errors and lockout policies.
- Keep environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) configured.