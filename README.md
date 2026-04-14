# Konserter - Samlad Konsertvy

En Vue-app där endast inloggad admin kan hantera källor och uppdatera konsertdata.

## Lokal start

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD=hemligt npm run dev
```

## Deploy på Vercel

1. Importera repo i Vercel.
2. Build: `npm run build`, output: `dist` (Vite auto-detekteras normalt).
3. Lägg miljövariabler:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD` eller `ADMIN_PASSWORD_HASH`
4. Lägg till Vercel KV och sätt:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
5. Deploya.

Appen använder serverless API via `api/[...route].js`.

## Inloggning

- Inloggning använder server-side session-cookie (`HttpOnly`, `SameSite=Lax`).
- Endast inloggad admin kan:
  - lägga till källor,
  - ta bort källor,
  - köra uppdatering av konserter,
  - byta lösenord.
- Konsertlistan är läsbar utan inloggning.

## Lösenordsbyte

- Byt lösenord i admin-vyn med:
  - nuvarande lösenord,
  - nytt lösenord,
  - bekräftelse.
- Nytt lösenord måste vara minst 10 tecken.
- Vid lyckat byte sparas hashat lösenord i lagring.
- Sparat admin-lösenord används före env-lösenord.

## Lagring

- I Vercel-produktion: Vercel KV (rekommenderat).
- Lokalt i dev: filer under `data/` används som fallback.

## Vilka källor fungerar

Appen försöker läsa konserter från:

- vanlig webbsida (HTML), genom att extrahera JSON-LD med `Event`, eller
- JSON-URL med array av konserter, alternativt objekt med `events` eller `concerts`.

Dessutom finns en fallback för Furuvik (`/konserter`) via deras `page-data`.
