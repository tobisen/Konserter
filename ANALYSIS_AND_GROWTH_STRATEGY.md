# Soundcheck - Analysis & Growth Strategy

## Current Product Snapshot

### Strengths

1. Clear value proposition: one place for concerts.
2. Strong core UX: filters, search, quick discovery, card/table views.
3. Retention features: favorites, going, seen, follow artist/venue.
4. Shareability: deep-links and share preview image.
5. Admin operations: source management + import quality + usage counters.
6. Solid deployment workflow on Vercel.

### Risks / Gaps

1. Source reliability varies between venue websites.
2. Limited geo coverage beyond Uppsala region.
3. Onboarding/discovery still depends on manual growth channels.
4. Full bilingual coverage is in progress and should be continuously validated.

## 30-Day Priorities

1. Source quality and stability
- Add parser health metrics by source.
- Add retry logic and parser diagnostics for failed imports.

2. Product polish
- Complete full SV/EN localization pass for every user-visible string.
- Tighten accessibility for menu/toggle controls and keyboard flow.

3. Distribution
- Launch share-first loop around concert cards.
- Publish weekly “Top concerts in Uppsala” content on social channels.

4. Measurement
- Track key events (view concert, favorite, booking, share click).
- Build a weekly KPI review habit.

## Distribution Plan (Uppsala + 5-10 mil)

### Channels

1. Instagram
- Short reels: "This weekend's concerts".
- Carousel posts from popular concerts data.

2. Facebook
- Local music/event groups.
- Weekly summary post with 3-5 highlighted events.

3. LinkedIn
- Position Soundcheck as a local cultural-tech project.
- Partner outreach to venues and organizers.

### Partnerships

1. Local venues
- Offer free listing visibility and source monitoring.
2. Student organizations
- Promote event discovery for student audiences.
3. Local media/blogs
- “What’s on this week” collaboration.

## KPI Framework

Track weekly:

1. Active users (WAU)
2. Favorites added
3. Bookings marked
4. Shares generated
5. Return rate (7-day)
6. Source import success ratio

## Execution Checklist Per Release

1. README updated
2. Project description updated
3. Analysis/Growth strategy updated
4. Help view aligned with latest UX
5. Playwright tests updated for UI changes
6. Build passes (`npm run build`)
