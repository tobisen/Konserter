# Soundcheck

Soundcheck is a Vue + Vite web app that aggregates concerts from multiple sources into one fast, searchable experience.

## Highlights

- Concert browsing with:
  - Upcoming/Past modes
  - Card view and table view
  - Filters (source, month, genre)
  - Single-date picker filter with highlighted event days
  - Search by artist, venue, and city
  - Quick discovery chips (All / This week / This weekend)
  - Popular this week block (based on likes + bookings)
- Rich concert cards:
  - Image (with fallback image)
  - Genre, source, details link
  - Share action (deep-link + generated preview image)
  - Add to calendar (`.ics`)
- User area (My Concerts):
  - Register/login
  - Welcome email on successful registration (when mail is configured)
  - Favorites, Going, Seen
  - Follow artists and venues
  - Password reset flow via email link (30 min token)
  - Branded email digest with reminders for saved/booked concerts and new follow matches
  - Weekly newsletter: “Veckans spelningar på Soundcheck” (multi-city digest)
- Admin area:
  - Source add/remove
  - Update concerts / clear concerts
  - Import quality status per source
  - Unique users and unique visitors
  - Delete user accounts (including their saved lists)
- UI/UX:
  - Sticky full-width header
  - Right-side slide menu (hamburger)
  - Contact page with menu entry and contact form
  - Language toggle (SV/EN, Swedish default)
  - Dynamic SEO title/description per app view

## Tech

- Frontend: Vue 3 + Vite
- Backend: Vercel serverless API
- Storage:
  - Production: Vercel KV (recommended)
  - Local fallback: JSON in `data/`

## Local Run

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD=secret npm run dev
```

Default URL: `http://localhost:5173`

## Environment Variables

### Required (admin)

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`

### Recommended (production storage)

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### Optional

- `SESSION_SECRET`
- `USER_SESSION_SECRET`
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `RESET_EMAIL_FROM`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `CONTACT_EMAIL_TO` (optional recipient for contact form)

### Required for Password Reset Emails in Production

- `RESEND_API_KEY`
- `RESET_EMAIL_FROM`

If these are missing in production, forgot-password returns an explicit configuration error instead of pretending to send email.

## Deployment (Vercel)

1. Import repository in Vercel.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Add environment variables.
5. Deploy.

## Testing

- E2E: Playwright (`tests/e2e`)
- Workflow: `.github/workflows/daily-playwright.yml`
- Triggers:
  - push to `main`
  - daily schedule
  - manual run

Optional secret:
- `PLAYWRIGHT_BASE_URL` (fallback: production URL)

## API Routing

- Single endpoint: `api/index.js`
- `vercel.json` rewrites `/api/:route*` to `/api?route=:route*`
- SPA rewrites for app views (`/spelningar`, `/mina-spelningar`, `/hjalp`, `/kontakt`, `/kallor`, `/admin`) to support hard reload on the same page.
- Static SEO files: `public/robots.txt` and `public/sitemap.xml`

## Data Sources

Supports multiple source patterns:

- Standard HTML pages
- JSON feeds
- JSON-LD event markup
- WordPress event APIs (custom post types)
- Source-specific fallback parsers where needed

## Release Checklist (Required Before Every Commit)

1. Update `README.md`.
2. Update `projekt beskrivning.md`.
3. Update `ANALYSIS_AND_GROWTH_STRATEGY.md`.
4. Keep Help view text aligned with current UX.
5. Update Playwright tests for UI changes.
6. Verify build (`npm run build`).
