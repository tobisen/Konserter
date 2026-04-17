# Konsertnavigator

A Vue + Vite app that aggregates concert events from multiple sources into one searchable view.

## What the App Does

- Public concert browsing with:
  - Upcoming and past views
  - Quick discovery chips: This Week, Weekend
  - Social proof block: "Popular this week" based on likes + bookings
  - Filters (source, month, genre)
  - Specific date picker filter (single date) with event-day markers in the calendar
  - Two display modes for concerts: wider card view and table view (date, artist, venue, city) with action buttons
  - Search by artist, venue, or city
  - Event images, genre, source name, and details link
  - "Dela spelning" button that copies a deep-link and generates a shareable preview image
  - Deep-link support to open a specific shared concert with a clear "Save to favorites" CTA
  - "Add to calendar" (`.ics`) export per concert
- User area (`My Concerts`) with:
  - Registration and login
  - Personal lists: Favorites, Going, Been There
  - Follow artists and venues
  - "New from what you follow" in-app notifications
  - Forgot-password and reset-password flow
  - Email reminders for tomorrow's saved concerts (Favorites/Going)
- Admin area with:
  - Source management (add/remove)
  - Manual update and clear actions
  - Per-source import quality status (fetched count / error / last run)
  - Unique registered users view
  - Unique visitors view
  - Admin password change

## Tech Stack

- Frontend: Vue 3 + Vite
- Backend: Serverless API handlers on Vercel
- Storage:
  - Production: Vercel KV (recommended)
  - Local fallback: JSON files in `data/`

## Local Development

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD=secret npm run dev
```

App URL (default): `http://localhost:5173`

## Environment Variables

### Required for admin login

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`

### Recommended for production storage

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### Optional (security/session)

- `SESSION_SECRET`
- `USER_SESSION_SECRET`

### Optional (password reset email)

- `APP_BASE_URL` (for reset links, e.g. `https://konsertnavigator.vercel.app`)
- `RESEND_API_KEY`
- `RESET_EMAIL_FROM` (e.g. `Konsertnavigator <noreply@yourdomain.com>`)

### Optional (Spotify integration)

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

To enable Spotify artist lookup with top tracks:

1. Create a Spotify app at https://developer.spotify.com/dashboard
2. Get your Client ID and Client Secret
3. Add them as environment variables

If Spotify credentials are missing, the feature gracefully degrades (users see an error).

If mail variables are missing, reset links are logged on the server as a fallback.
The same mail config is also used for concert reminder emails.
When mail is not configured, the app runs in a logs-only test mode for reset/reminder messages.

## Vercel Deployment

1. Import the GitHub repo in Vercel.
2. Keep build command as `npm run build`.
3. Ensure output is `dist` (auto-detected by Vite in most cases).
4. Configure the environment variables above.
5. Enable Analytics in Vercel Project Settings (`Analytics` tab) if you want dashboard metrics.
6. Deploy.

## Automated E2E Tests (Playwright)

- Smoke tests are defined in `tests/e2e/smoke.spec.ts`.
- Workflow file: `.github/workflows/daily-playwright.yml`.
- Runs:
  - On every push to `main`
  - Daily (scheduled)
  - Manually (`workflow_dispatch`)
- Optional GitHub secret:
  - `PLAYWRIGHT_BASE_URL` (defaults to `https://konsertnavigator.vercel.app` if not set)

## API Routing Notes

- API is served through a single endpoint in `api/index.js`.
- `vercel.json` rewrites `/api/:route*` to `/api?route=:route*`.
- This keeps function count low and avoids hobby-plan function limits.

## Data Sources

The app tries to parse concerts from:

- Standard web pages (HTML), including JSON-LD event data
- JSON feeds (`events`, `concerts`, `items`, or array payloads)
- WordPress custom post type event APIs (for example `wp-json/wp/v2/konsert` used by Dalhalla)
- Source-specific fallbacks currently included for some venues/pages used in this project

## Security Notes

- Admin and user sessions use server-side signed cookies (`HttpOnly`, `SameSite=Lax`).
- Admin endpoints are protected by admin auth.
- User login includes rate-limiting.
- Password reset uses time-limited hashed reset tokens.

## Release Checklist (Required on Every Commit)

Before pushing commits, always verify:

1. README matches the current feature set and routing/deploy setup.
2. Version in `package.json` is correct.
3. Build succeeds locally (`npm run build`).

This checklist is part of the project workflow and should be followed on every check-in.
```
