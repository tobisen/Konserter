# Project Description - Konsertnavigator

## Overview

Konsertnavigator is a web application for collecting, organizing, and exploring concert events from multiple external sources in one place. The project started as a simple concert list and evolved into a complete platform with admin tooling, user accounts, personal concert tracking, search/filtering, and operational visibility.

## Core Goals

- Aggregate concert data from many source websites.
- Keep data updates additive (do not remove existing concerts on update).
- Make source management easy for admin users.
- Offer a clean public browsing experience for visitors.
- Support personal user flows: favorites, planned attendance, and seen concerts.
- Provide operational controls and visibility for admins.

## What We Built

### 1. Data Aggregation and Normalization

- Source ingestion from HTML pages and JSON feeds.
- Support for WordPress event APIs on custom post types (e.g. Dalhalla `wp-json/wp/v2/konsert`).
- Source-specific parsing fallbacks for selected websites.
- Concert normalization:
  - artist/title/date/venue/city
  - optional genre/details URL/image URL
- Stable concert IDs generated from normalized fields.
- Additive merge behavior on updates.

### 2. Public Concert Experience

- Main concert view with:
  - Upcoming / Past subviews
  - Two display modes: wider card-style view and table-style list (date/artist/venue/city) with action buttons in both modes
  - Filtering by source, month, and genre
  - Single-date picker filter with highlighted event days
  - Search by artist, venue, and city
- Concert cards with image, metadata, details link, share action, and calendar export (`.ics`).
- Shared concert deep-links (`?concert=...`) that open the Concerts view and highlight the target concert.
- Clear call-to-action for shared links to save the concert to Favorites.

### 3. Personal User Experience (My Concerts)

- User registration and login.
- Required email at registration.
- Personal lists:
  - Favorites
  - Going
  - Been There
- Favorites improvements:
  - sorting options
  - new favorite-artist notification when matching concerts appear

### 4. Authentication and Security

- Admin authentication with secure session cookies.
- User authentication with secure session cookies.
- Rate-limiting for user login attempts.
- Password reset flow with time-limited token.
- Optional email delivery via Resend for reset/reminder emails.
- Logs-only fallback mode when email is not configured.

### 5. Admin Operations

- Dedicated Admin view with subviews:
  - Sources
  - Unique users
  - Unique visitors
- Admin actions:
  - add/remove sources
  - update concerts
  - clear concerts
  - change admin password
- Import quality status per source:
  - fetched count
  - last error
  - last run timestamp
- Counters for unique users and unique visitors.

### 6. Notifications and Automation

- Scheduled update endpoint via Vercel cron.
- Tomorrow reminders for concerts saved in Favorites or Going.
- Reminder deduplication to avoid duplicate sends.

### 7. UX and Product Structure

- Multi-page navigation:
  - Home
  - Sources
  - Concerts
  - My Concerts
  - Help
  - Admin
- Swedish Help page explaining all available features.
- Version/build display in header for release clarity.

## Technical Stack

- Frontend: Vue 3 + Vite
- Backend: Serverless API on Vercel
- Persistence:
  - Vercel KV in production (recommended)
  - JSON file fallback for local/dev

## Project Maturity (v1.2.0)

Version 1.2.0 adds Spotify music discovery integration:

- End-to-end source ingestion
- Public and authenticated user journeys
- Operational admin controls with visitor tracking and clear functionality
- Security baseline and password recovery
- Notification capabilities and monitoring surfaces
- Concert-level sharing with deep-link and save-to-favorites CTA
- **NEW:** Spotify integration showing artist info and top 5 tracks
  - Artist lookup via Spotify API
  - Preview tracks and direct Spotify links
  - Popularity metrics
  - Graceful fallback if not configured

Konsertnavigator is now a feature-rich MVP suitable for production use with growing engagement features.
