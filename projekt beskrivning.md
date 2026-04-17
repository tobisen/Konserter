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
- Source-specific parser fallbacks for selected venues.
- Normalized concert model:
  - artist, title, date, venue, city
  - optional genre, details URL, image URL
- Stable concert IDs and additive merge updates.

### 2. Public Experience

- Upcoming/Past views.
- Card and table display modes.
- Filters by source, month, genre.
- Single-date picker (with event-day markers).
- Search by artist, venue, city.
- Shareable concert deep-links and preview image generation.
- Calendar export (`.ics`).

### 3. My Concerts

- Registration/login.
- Favorites, Going, Seen lists.
- Follow artists and venues.
- Password reset flow.

### 4. Admin Experience

- Dedicated admin view.
- Source add/remove.
- Update/clear concerts.
- Import quality monitor per source.
- Unique users and unique visitors overview.

### 5. UX Structure

- Sticky full-width header.
- Right-side slide menu (hamburger navigation).
- Header quick actions for Concerts/My Concerts.
- Language toggle (SV/EN, Swedish default).
- Rock-inspired visual theme and concert-first layout.

## Technical Stack

- Vue 3 + Vite frontend
- Vercel serverless API backend
- Vercel KV (prod) + JSON fallback (local)
- Playwright E2E test suite + GitHub Actions schedule

## Status

Soundcheck is a production-ready MVP with live source ingestion, user features, admin tooling, and an evolving growth/distribution plan.
