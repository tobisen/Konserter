# Project Description - Soundcheck

## Overview

Soundcheck is a concert discovery platform focused on Uppsala and nearby regions. It collects event data from many external sources and presents everything in one consistent interface for visitors, signed-in users, and admins.

## Product Goals

- Aggregate concerts from many sites into one place.
- Keep updates additive (never remove existing concerts during update).
- Make source operations simple for admin.
- Provide a clean browsing and filtering experience.
- Let users save and track concerts personally.

## Current Scope

### 1. Aggregation and Normalization

- Ingestion from HTML, JSON, JSON-LD, and WordPress event APIs.
- Source-specific parser fallbacks for selected venues, including poster-style listing pages and event archives.
- Normalized concert model:
  - artist, title, date, venue, city
  - optional genre, details URL, image URL
- Stable concert IDs and additive merge updates.
- Better error reporting when a source fails during import or returns invalid data.

### 2. Public Experience

- Upcoming/Past views.
- Card and table display modes.
- Filters by source, month, genre.
- Single-date picker (with event-day markers).
- Quick discovery tabs for All, This week, This weekend, and Latest added.
- Search by artist, venue, city.
- Shareable concert deep-links and preview image generation.
- Calendar export (`.ics`).
- Merch page with product cards, images, prices, and external Fourthwall CTAs.
- Contact page with a public contact form in the main menu.
- SEO baseline with stronger static metadata, brand search variants, dynamic route metadata, clean canonical URLs, robots directives, structured data, crawlable footer links, sitemap/robots, `llms.txt`, OpenSearch and web manifest.
- "Latest added" view that shows the concerts from the latest import batch where new additions were found.
- New source coverage for Dog Bar Uppsala and Kulturoasen, using lightweight source-specific parsers where their markup differs from the standard event feeds.

### 3. My Concerts

- Registration/login.
- Welcome email on successful registration (mail-configured environments).
- Favorites, Going, Seen lists.
- Follow artists and venues.
- Password reset by email link (30-minute token).
- Branded email digest for:
  - saved/booked concerts happening tomorrow
  - new concerts matching followed artists/venues
- Weekly multi-city newsletter digest.
- User-managed email preferences:
  - Newsletter on/off
  - Reminder digest on/off
  - Welcome + password-reset emails always allowed
- Unsubscribe page linked directly from newsletter and reminder emails.

### 4. Admin Experience

- Dedicated admin view.
- Source add/remove.
- Update/clear concerts.
- Remove individual concerts from admin when imports create duplicates.
- Import quality monitor per source.
- Update feedback now surfaces the source name or import step that failed instead of hiding behind a generic error.
- Unique users and unique visitors overview.
- Delete user accounts and all user-specific saved lists.

### 5. UX Structure

- Sticky full-width header.
- Right-side slide menu (hamburger navigation).
- Header quick actions for Concerts/My Concerts/Merch/Support, including a mobile-visible quick navigation row.
- Ko-fi support link in the header and slide menu.
- Language toggle (SV/EN, Swedish default).
- Merch page copy, buttons, image labels, and lightbox controls are translated for Swedish and English.
- Help text aligned with the current app flow, including the new Latest added view.
- Rock-inspired visual theme and concert-first layout.

## Technical Stack

- Vue 3 + Vite frontend
- Vercel serverless API backend
- Vercel KV (prod) + JSON fallback (local)
- Playwright E2E test suite + GitHub Actions schedule
- Vercel SPA rewrites for stable deep-link and reload behavior.

## Status

Soundcheck is a production-ready MVP with live source ingestion, user features, admin tooling, and an evolving growth/distribution plan.
