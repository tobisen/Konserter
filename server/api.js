import crypto from "node:crypto";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

import {
  getAuthenticatedUser,
  handleAuthMe,
  handleChangePassword,
  handleLogin,
  handleLogout,
  requireAuth,
} from "./auth.js";
import {
  handleUserForgotPassword,
  handleUserLogin,
  handleUserLogout,
  handleUserMe,
  handleUserResetPassword,
  handleUserRegister,
  isMailDeliveryConfigured,
  requireAppUser,
} from "./userAuth.js";
import {
  fetchConcertsFromUrl,
  handleSourceEventsRequest,
} from "./sourceEvents.js";
import {
  loadConcertsFromFile,
  loadMetaFromStore,
  loadSourcesFromFile,
  loadUsersFromStore,
  saveConcertsToFile,
  saveMetaToStore,
  saveSourcesToFile,
  saveUsersToStore,
} from "./storage.js";

// Spotify cache
let spotifyTokenCache = { token: null, expiresAt: 0 };

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader = "") {
  const cookies = {};

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("="));
  }

  return cookies;
}

function toUrl(request) {
  return new URL(request.url || "/", "http://localhost");
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Ogiltig JSON");
  }
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createStableId(concert) {
  return [
    normalizeText(concert.artist),
    normalizeText(concert.venue),
    normalizeText(concert.city),
    new Date(concert.date).toISOString(),
  ].join("|");
}

function parseConcertDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOptionalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeOptionalImageUrl(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  if (text.startsWith("//")) {
    text = `https:${text}`;
  }

  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeIncomingConcert(rawConcert, sourceName) {
  return {
    artist: String(rawConcert.artist || "").trim(),
    title: String(rawConcert.title || "").trim(),
    date: String(rawConcert.date || "").trim(),
    venue: String(rawConcert.venue || "").trim(),
    city: String(rawConcert.city || "").trim(),
    genre: String(rawConcert.genre || "").trim(),
    detailsUrl: normalizeOptionalUrl(rawConcert.detailsUrl),
    imageUrl: normalizeOptionalImageUrl(rawConcert.imageUrl),
    sourceName,
  };
}

function isValidConcert(concert) {
  if (!concert.artist || !concert.title || !concert.venue || !concert.city) {
    return false;
  }

  return Boolean(parseConcertDate(concert.date));
}

async function handleGetConcerts(response) {
  const concerts = await loadConcertsFromFile();
  const meta = await loadMetaFromStore();
  sendJson(response, 200, {
    concerts,
    lastUpdatedAt: meta.lastUpdatedAt || null,
  });
}

async function handleGetPopularConcerts(response) {
  const users = await loadUsersFromStore();
  const byConcertId = new Map();

  for (const user of users) {
    const favoriteIds = new Set(Array.isArray(user?.favorites) ? user.favorites : []);
    const bookingIds = new Set(Array.isArray(user?.bookings) ? user.bookings : []);

    for (const concertId of favoriteIds) {
      if (!concertId) continue;
      const current = byConcertId.get(concertId) || {
        concertId,
        likes: 0,
        bookings: 0,
        score: 0,
      };
      current.likes += 1;
      current.score += 1;
      byConcertId.set(concertId, current);
    }

    for (const concertId of bookingIds) {
      if (!concertId) continue;
      const current = byConcertId.get(concertId) || {
        concertId,
        likes: 0,
        bookings: 0,
        score: 0,
      };
      current.bookings += 1;
      current.score += 1;
      byConcertId.set(concertId, current);
    }
  }

  const items = [...byConcertId.values()].sort(
    (a, b) => b.score - a.score || b.bookings - a.bookings || b.likes - a.likes,
  );

  sendJson(response, 200, { items });
}

async function handleGetSources(request, response) {
  const user = getAuthenticatedUser(request);
  const sources = await loadSourcesFromFile();
  const meta = await loadMetaFromStore();
  const sourceRuns =
    meta?.sourceRuns && typeof meta.sourceRuns === "object"
      ? meta.sourceRuns
      : {};

  if (user) {
    const sourceStatus = sources.map((source) => ({
      sourceId: source.id,
      sourceName: source.name,
      fetchedCount: Number(sourceRuns[source.id]?.fetchedCount || 0),
      error: String(sourceRuns[source.id]?.error || ""),
      lastRunAt: sourceRuns[source.id]?.lastRunAt || null,
    }));

    sendJson(response, 200, { sources, sourceStatus });
    return;
  }

  const publicSources = sources.map((source) => ({
    id: source.id,
    name: source.name,
  }));

  sendJson(response, 200, { sources: publicSources });
}

async function handleAddSource(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const name = String(body?.name || "").trim();
  const url = String(body?.url || "").trim();

  if (!name || !url) {
    sendJson(response, 400, { error: "Namn och URL måste anges." });
    return;
  }

  try {
    new URL(url);
  } catch {
    sendJson(response, 400, { error: "URL är inte giltig." });
    return;
  }

  const sources = await loadSourcesFromFile();
  const duplicate = sources.some(
    (source) => source.url.toLowerCase() === url.toLowerCase(),
  );

  if (duplicate) {
    sendJson(response, 409, { error: "Källan finns redan i listan." });
    return;
  }

  const nextSources = [
    ...sources,
    {
      id: crypto.randomUUID(),
      name,
      url,
    },
  ];

  await saveSourcesToFile(nextSources);
  sendJson(response, 201, { sources: nextSources });
}

async function handleDeleteSource(request, response, sourceId) {
  const user = requireAuth(request, response);
  if (!user) return;

  const sources = await loadSourcesFromFile();
  const nextSources = sources.filter((source) => source.id !== sourceId);

  await saveSourcesToFile(nextSources);
  sendJson(response, 200, { sources: nextSources });
}

async function runConcertUpdate() {
  const sources = await loadSourcesFromFile();

  if (sources.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      payload: { error: "Lägg till minst en källa innan uppdatering." },
    };
  }

  const currentConcerts = await loadConcertsFromFile();

  const sourceResults = await Promise.allSettled(
    sources.map(async (source) => {
      const fetched = await fetchConcertsFromUrl(source.url);
      return fetched
        .map((concert) => normalizeIncomingConcert(concert, source.name))
        .filter(isValidConcert);
    }),
  );

  const incomingConcerts = [];
  const errors = [];
  const sourceRuns = {};
  const updateTimestamp = new Date().toISOString();

  for (let i = 0; i < sourceResults.length; i += 1) {
    const result = sourceResults[i];
    const source = sources[i];

    if (result.status === "fulfilled") {
      incomingConcerts.push(...result.value);
      sourceRuns[source.id] = {
        fetchedCount: result.value.length,
        error: "",
        lastRunAt: updateTimestamp,
      };
      continue;
    }

    sourceRuns[source.id] = {
      fetchedCount: 0,
      error: String(result.reason?.message || "okänt fel"),
      lastRunAt: updateTimestamp,
    };
    errors.push(`${source.name}: ${result.reason?.message || "okänt fel"}`);
  }

  const existingIds = new Set(currentConcerts.map(createStableId));
  const additions = incomingConcerts.filter(
    (concert) => !existingIds.has(createStableId(concert)),
  );

  const merged = [...currentConcerts, ...additions].sort(
    (a, b) => parseConcertDate(a.date) - parseConcertDate(b.date),
  );

  if (additions.length > 0) {
    await saveConcertsToFile(merged);
  }

  const meta = await loadMetaFromStore();
  await saveMetaToStore({
    ...meta,
    lastUpdatedAt: updateTimestamp,
    sourceRuns: {
      ...(meta?.sourceRuns && typeof meta.sourceRuns === "object"
        ? meta.sourceRuns
        : {}),
      ...sourceRuns,
    },
  });

  return {
    ok: true,
    statusCode: 200,
    payload: {
      concerts: additions.length > 0 ? merged : currentConcerts,
      addedCount: additions.length,
      errors,
      lastUpdatedAt: updateTimestamp,
      sourceStatus: sources.map((source) => ({
        sourceId: source.id,
        sourceName: source.name,
        fetchedCount: Number(sourceRuns[source.id]?.fetchedCount || 0),
        error: String(sourceRuns[source.id]?.error || ""),
        lastRunAt: sourceRuns[source.id]?.lastRunAt || null,
      })),
    },
  };
}

async function handleUpdateConcerts(request, response) {
  const result = await runConcertUpdate();
  sendJson(response, result.statusCode, result.payload);
}

function isCronAuthorized(request, url) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const authorization = String(request.headers.authorization || "");
  if (authorization === `Bearer ${configuredSecret}`) {
    return true;
  }

  return url.searchParams.get("secret") === configuredSecret;
}

function getStockholmDateKey(date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getTomorrowStockholmDateKey() {
  const stockholmNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" }),
  );
  stockholmNow.setDate(stockholmNow.getDate() + 1);
  return getStockholmDateKey(stockholmNow);
}

function buildConcertReminderLine(concert, listTags) {
  const dateText = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(concert.date));

  const tags = listTags.join(", ");
  return `- ${concert.artist} (${dateText}) på ${concert.venue}, ${concert.city} [${tags}]`;
}

async function sendReminderEmail(email, subject, textBody, htmlBody) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromEmail = String(process.env.RESET_EMAIL_FROM || "").trim();

  if (resendApiKey && fromEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      throw new Error(
        `Kunde inte skicka påminnelsemail (${response.status}): ${payload}`,
      );
    }

    return;
  }

  console.info(`[ReminderEmail] ${email}\n${textBody}`);
}

async function sendTomorrowConcertReminders() {
  const users = await loadUsersFromStore();
  const concerts = await loadConcertsFromFile();
  const concertsById = new Map(
    concerts.map((concert) => [createStableId(concert), concert]),
  );
  const tomorrowKey = getTomorrowStockholmDateKey();
  const sentAt = new Date().toISOString();

  const meta = await loadMetaFromStore();
  const reminderLog =
    meta?.reminderLog && typeof meta.reminderLog === "object"
      ? meta.reminderLog
      : {};
  const nextReminderLog = { ...reminderLog };

  let emailsSent = 0;
  let usersNotified = 0;

  for (const user of users) {
    const email = String(user?.email || "").trim();
    if (!email) continue;

    const favoriteIds = Array.isArray(user.favorites) ? user.favorites : [];
    const bookingIds = Array.isArray(user.bookings) ? user.bookings : [];

    const groupedByConcertId = new Map();
    for (const concertId of favoriteIds) {
      if (!groupedByConcertId.has(concertId))
        groupedByConcertId.set(concertId, new Set());
      groupedByConcertId.get(concertId).add("Favorit");
    }
    for (const concertId of bookingIds) {
      if (!groupedByConcertId.has(concertId))
        groupedByConcertId.set(concertId, new Set());
      groupedByConcertId.get(concertId).add("Ska gå");
    }

    const reminderItems = [];
    for (const [concertId, tags] of groupedByConcertId.entries()) {
      const dedupeKey = `${tomorrowKey}:${user.id}:${concertId}`;
      if (nextReminderLog[dedupeKey]) continue;

      const concert = concertsById.get(concertId);
      if (!concert) continue;

      const concertDate = parseConcertDate(concert.date);
      if (!concertDate) continue;
      if (getStockholmDateKey(concertDate) !== tomorrowKey) continue;

      reminderItems.push({
        concertId,
        concert,
        tags: [...tags],
      });
    }

    if (reminderItems.length === 0) {
      continue;
    }

    const textLines = reminderItems.map((item) =>
      buildConcertReminderLine(item.concert, item.tags),
    );
    const textBody =
      `Hej ${user.username || ""},\n\n` +
      `Du har ${reminderItems.length} spelning(ar) imorgon:\n` +
      `${textLines.join("\n")}\n\n` +
      "Ha en grym konsertkväll!";

    const htmlBody =
      `<p>Hej ${String(user.username || "").replace(/</g, "&lt;")}!</p>` +
      `<p>Du har <strong>${reminderItems.length}</strong> spelning(ar) imorgon:</p>` +
      `<ul>${reminderItems
        .map(
          (item) =>
            `<li>${buildConcertReminderLine(item.concert, item.tags).replace(/</g, "&lt;")}</li>`,
        )
        .join("")}</ul>` +
      "<p>Ha en grym konsertkväll!</p>";

    await sendReminderEmail(
      email,
      "Påminnelse: dina spelningar imorgon",
      textBody,
      htmlBody,
    );
    usersNotified += 1;
    emailsSent += 1;

    for (const item of reminderItems) {
      const dedupeKey = `${tomorrowKey}:${user.id}:${item.concertId}`;
      nextReminderLog[dedupeKey] = sentAt;
    }
  }

  const oldestAllowed = Date.now() - 45 * 24 * 60 * 60 * 1000;
  const prunedReminderLog = Object.fromEntries(
    Object.entries(nextReminderLog).filter(([, value]) => {
      const asTime = new Date(value).getTime();
      return Number.isFinite(asTime) && asTime >= oldestAllowed;
    }),
  );

  await saveMetaToStore({
    ...meta,
    reminderLog: prunedReminderLog,
  });

  return {
    tomorrowDate: tomorrowKey,
    usersNotified,
    emailsSent,
  };
}

async function handleCronUpdateConcerts(request, response, url) {
  if (!isCronAuthorized(request, url)) {
    sendJson(response, 401, { error: "Unauthorized cron request." });
    return;
  }

  const updateResult = await runConcertUpdate();
  const reminderResult = await sendTomorrowConcertReminders().catch(
    (error) => ({
      error: error instanceof Error ? error.message : "Unknown reminder error",
    }),
  );

  sendJson(response, updateResult.statusCode, {
    ...updateResult.payload,
    reminders: reminderResult,
  });
}

async function handleClearConcerts(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  const currentConcerts = await loadConcertsFromFile();
  await saveConcertsToFile([]);

  sendJson(response, 200, {
    concerts: [],
    clearedCount: currentConcerts.length,
  });
}

function buildVisitorCookie(visitorId) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `visitor_id=${encodeURIComponent(visitorId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 365}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function isBot(userAgent) {
  if (!userAgent) return false;
  const botPatterns = [
    "bot",
    "crawler",
    "spider",
    "scraper",
    "google",
    "bing",
    "yahoo",
    "duckduckgo",
    "baidu",
    "yandex",
    "curl",
    "wget",
    "python",
    "java",
    "postman",
    "insomnia",
    "monitor",
    "health",
    "check",
    "ping",
    "uptime",
  ];
  const lowerUserAgent = userAgent.toLowerCase();
  return botPatterns.some((pattern) => lowerUserAgent.includes(pattern));
}

async function handleTrackVisitor(request, response) {
  const userAgent = String(request.headers["user-agent"] || "").trim();

  // Filter out bots
  if (isBot(userAgent)) {
    sendJson(response, 200, { ok: true });
    return;
  }

  const cookies = parseCookies(request.headers.cookie);
  const existingVisitorId = String(cookies.visitor_id || "").trim();
  const visitorId = existingVisitorId || crypto.randomUUID();
  const now = new Date().toISOString();

  const meta = await loadMetaFromStore();
  const currentVisitors =
    meta?.visitors && typeof meta.visitors === "object" ? meta.visitors : {};
  const previous = currentVisitors[visitorId] || {};

  await saveMetaToStore({
    ...meta,
    visitors: {
      ...currentVisitors,
      [visitorId]: {
        firstSeenAt: previous.firstSeenAt || now,
        lastSeenAt: now,
      },
    },
  });

  if (!existingVisitorId) {
    response.setHeader("Set-Cookie", buildVisitorCookie(visitorId));
  }

  sendJson(response, 200, { ok: true });
}

async function handleGetAdminUsers(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  const users = await loadUsersFromStore();
  const uniqueUsernames = [
    ...new Set(
      users.map((entry) => String(entry.username || "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "sv-SE"));

  sendJson(response, 200, {
    users: uniqueUsernames,
    count: uniqueUsernames.length,
  });
}

async function handleGetAdminVisitors(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  const meta = await loadMetaFromStore();
  const visitors =
    meta?.visitors && typeof meta.visitors === "object" ? meta.visitors : {};

  const items = Object.entries(visitors)
    .map(([id, value]) => ({
      id,
      firstSeenAt: value?.firstSeenAt || null,
      lastSeenAt: value?.lastSeenAt || null,
    }))
    .sort((a, b) =>
      String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")),
    );

  sendJson(response, 200, {
    visitors: items,
    count: items.length,
  });
}

async function handleClearAdminVisitors(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  const meta = await loadMetaFromStore();
  await saveMetaToStore({
    ...meta,
    visitors: {},
  });

  sendJson(response, 200, {
    ok: true,
    message: "Alla besökare har rensats.",
  });
}

async function handleGetAdminMailStatus(request, response) {
  const user = requireAuth(request, response);
  if (!user) return;

  const configured = isMailDeliveryConfigured();
  sendJson(response, 200, {
    configured,
    mode: configured ? "email" : "logs_only",
  });
}

const USER_LISTS = {
  favorites: "favorites",
  bookings: "bookings",
  seen: "seen",
};

function normalizeUserLists(user) {
  return {
    favorites: Array.isArray(user?.favorites) ? user.favorites : [],
    bookings: Array.isArray(user?.bookings) ? user.bookings : [],
    seen: Array.isArray(user?.seen) ? user.seen : [],
  };
}

function normalizeUserListType(value) {
  const type = String(value || "").toLowerCase();
  return Object.values(USER_LISTS).includes(type) ? type : null;
}

function assertValidConcertId(concertId, validConcertIds) {
  if (!concertId) {
    return "Ogiltigt konsert-id.";
  }

  if (!validConcertIds.has(concertId)) {
    return "Kunde inte hitta spelningen.";
  }

  return null;
}

async function handleGetUserLists(request, response) {
  const user = await requireAppUser(request, response);
  if (!user) return;

  sendJson(response, 200, normalizeUserLists(user));
}

async function handleAddToUserList(request, response, listType, concertId) {
  const user = await requireAppUser(request, response);
  if (!user) return;

  const type = normalizeUserListType(listType);
  if (!type) {
    sendJson(response, 400, { error: "Ogiltig listtyp." });
    return;
  }

  const users = await loadUsersFromStore();
  const concerts = await loadConcertsFromFile();
  const validConcertIds = new Set(concerts.map(createStableId));
  const validationError = assertValidConcertId(concertId, validConcertIds);

  if (validationError) {
    sendJson(response, validationError.includes("hitta") ? 404 : 400, {
      error: validationError,
    });
    return;
  }

  const nextUsers = users.map((entry) => {
    if (entry.id !== user.id) return entry;

    const currentList = Array.isArray(entry[type]) ? entry[type] : [];
    if (currentList.includes(concertId)) return entry;

    return {
      ...entry,
      [type]: [...currentList, concertId],
    };
  });

  await saveUsersToStore(nextUsers);
  const updatedUser = nextUsers.find((entry) => entry.id === user.id);
  sendJson(response, 200, normalizeUserLists(updatedUser));
}

async function handleRemoveFromUserList(
  request,
  response,
  listType,
  concertId,
) {
  const user = await requireAppUser(request, response);
  if (!user) return;

  const type = normalizeUserListType(listType);
  if (!type) {
    sendJson(response, 400, { error: "Ogiltig listtyp." });
    return;
  }

  const users = await loadUsersFromStore();
  const nextUsers = users.map((entry) => {
    if (entry.id !== user.id) return entry;
    return {
      ...entry,
      [type]: (entry[type] || []).filter((id) => id !== concertId),
    };
  });

  await saveUsersToStore(nextUsers);
  const updatedUser = nextUsers.find((entry) => entry.id === user.id);
  sendJson(response, 200, normalizeUserLists(updatedUser));
}

async function handleGetUserFavorites(request, response) {
  const user = await requireAppUser(request, response);
  if (!user) return;

  const lists = normalizeUserLists(user);
  sendJson(response, 200, { favorites: lists.favorites });
}

async function handleAddUserFavorite(request, response, concertId) {
  await handleAddToUserList(request, response, USER_LISTS.favorites, concertId);
}

async function handleDeleteUserFavorite(request, response, concertId) {
  await handleRemoveFromUserList(
    request,
    response,
    USER_LISTS.favorites,
    concertId,
  );
}

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (spotifyTokenCache.token && spotifyTokenCache.expiresAt > now) {
    return spotifyTokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log(
    `Spotify auth: ID=${clientId ? "✓" : "✗"}, Secret=${clientSecret ? "✓" : "✗"}`,
  );

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error(
      `Spotify token error: ${response.status}`,
      JSON.stringify(data),
    );
    throw new Error(
      data.error_description || "Failed to get Spotify access token",
    );
  }

  console.log(`Spotify token obtained successfully`);
  spotifyTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

async function handleSpotifySearch(request, response) {
  try {
    const url = new URL(request.url || "", "http://localhost");
    const artist = decodeURIComponent(url.searchParams.get("artist") || "");

    if (!artist || artist.length < 2) {
      sendJson(response, 400, { error: "Artist name required" });
      return;
    }

    const token = await getSpotifyAccessToken();
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("q", `artist:${artist}`);
    searchUrl.searchParams.set("type", "artist");
    searchUrl.searchParams.set("limit", "1");

    console.log(
      `Searching artist with token: Bearer ${token.substring(0, 20)}...`,
    );
    const searchResponse = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Search response status: ${searchResponse.status}`);
    const searchData = await searchResponse.json();

    if (!searchData.artists?.items?.[0]) {
      sendJson(response, 200, { tracks: [] });
      return;
    }

    const artistId = searchData.artists.items[0].id;
    const artistName = searchData.artists.items[0].name;
    const artistImage = searchData.artists.items[0].images?.[0]?.url || null;
    const spotifyUrl =
      searchData.artists.items[0].external_urls?.spotify || null;

    // Get top tracks - try alternative approach if 403
    const tracksUrl = new URL(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
    );
    tracksUrl.searchParams.set("market", "SE");

    console.log(`Fetching tracks from: ${tracksUrl.toString()}`);

    let tracksResponse = await fetch(tracksUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    let tracksData = { tracks: [] };

    if (tracksResponse.ok) {
      tracksData = await tracksResponse.json();
      console.log(`Found ${tracksData.tracks?.length || 0} tracks`);
    } else if (tracksResponse.status === 403) {
      // Fallback: use search to get tracks
      console.log(`top-tracks returned 403, using search fallback`);
      const searchTracksUrl = new URL("https://api.spotify.com/v1/search");
      searchTracksUrl.searchParams.set("q", `artist:"${artistName}"`);
      searchTracksUrl.searchParams.set("type", "track");
      searchTracksUrl.searchParams.set("limit", "5");

      const searchTracksResponse = await fetch(searchTracksUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (searchTracksResponse.ok) {
        const searchTracksData = await searchTracksResponse.json();
        tracksData.tracks = searchTracksData.tracks?.items || [];
        console.log(`Found ${tracksData.tracks.length} tracks via search`);
      } else {
        console.error(
          `Search fallback also failed: ${searchTracksResponse.status}`,
        );
      }
    } else {
      const errorText = await tracksResponse.text();
      console.error(
        `Spotify tracks API error: ${tracksResponse.status}`,
        errorText,
      );
    }

    const tracks = (tracksData.tracks || []).slice(0, 3).map((track) => ({
      name: track.name,
      url: track.external_urls?.spotify || null,
      preview: track.preview_url || null,
      image: track.album?.images?.[0]?.url || null,
      popularity: track.popularity,
    }));

    sendJson(response, 200, {
      artist: artistName,
      artistImage,
      spotifyUrl,
      tracks,
    });
  } catch (error) {
    console.error("Spotify search error:", error);
    sendJson(response, 500, {
      error: error.message || "Failed to search Spotify",
    });
  }
}

export async function handleApiRequest(request, response) {
  const url = toUrl(request);
  const pathname = url.pathname.startsWith("/api")
    ? url.pathname
    : `/api${url.pathname}`;

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    handleAuthMe(request, response);
    return;
  }

  if (pathname === "/api/users/me" && request.method === "GET") {
    await handleUserMe(request, response);
    return;
  }

  if (pathname === "/api/visitors/ping" && request.method === "POST") {
    await handleTrackVisitor(request, response);
    return;
  }

  if (pathname === "/api/spotify/search" && request.method === "GET") {
    await handleSpotifySearch(request, response);
    return;
  }

  if (pathname === "/api/source-events") {
    await handleSourceEventsRequest(request, response);
    return;
  }

  if (pathname === "/api/cron/update-concerts" && request.method === "GET") {
    await handleCronUpdateConcerts(request, response, url);
    return;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleLogin(request, response, body);
    return;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    handleLogout(request, response);
    return;
  }

  if (pathname === "/api/users/register" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleUserRegister(request, response, body);
    return;
  }

  if (pathname === "/api/users/login" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleUserLogin(request, response, body);
    return;
  }

  if (pathname === "/api/users/forgot-password" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleUserForgotPassword(request, response, body);
    return;
  }

  if (pathname === "/api/users/reset-password" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleUserResetPassword(request, response, body);
    return;
  }

  if (pathname === "/api/users/logout" && request.method === "POST") {
    handleUserLogout(request, response);
    return;
  }

  if (pathname === "/api/auth/change-password" && request.method === "POST") {
    const user = requireAuth(request, response);
    if (!user) return;

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleChangePassword(request, response, user, body);
    return;
  }

  if (pathname === "/api/concerts" && request.method === "GET") {
    await handleGetConcerts(response);
    return;
  }

  if (pathname === "/api/concerts/popular" && request.method === "GET") {
    await handleGetPopularConcerts(response);
    return;
  }

  if (pathname === "/api/concerts/update" && request.method === "POST") {
    await handleUpdateConcerts(request, response);
    return;
  }

  if (pathname === "/api/concerts/clear" && request.method === "POST") {
    await handleClearConcerts(request, response);
    return;
  }

  if (pathname === "/api/sources" && request.method === "GET") {
    await handleGetSources(request, response);
    return;
  }

  if (pathname === "/api/sources" && request.method === "POST") {
    await handleAddSource(request, response);
    return;
  }

  if (pathname === "/api/users/favorites" && request.method === "GET") {
    await handleGetUserFavorites(request, response);
    return;
  }

  if (pathname === "/api/users/favorites" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleAddUserFavorite(
      request,
      response,
      String(body?.concertId || ""),
    );
    return;
  }

  if (
    pathname.startsWith("/api/users/favorites/") &&
    request.method === "DELETE"
  ) {
    const concertId = decodeURIComponent(
      pathname.slice("/api/users/favorites/".length),
    );
    await handleDeleteUserFavorite(request, response, concertId);
    return;
  }

  if (pathname === "/api/users/lists" && request.method === "GET") {
    await handleGetUserLists(request, response);
    return;
  }

  if (pathname === "/api/admin/users" && request.method === "GET") {
    await handleGetAdminUsers(request, response);
    return;
  }

  if (pathname === "/api/admin/visitors" && request.method === "GET") {
    await handleGetAdminVisitors(request, response);
    return;
  }

  if (pathname === "/api/admin/visitors" && request.method === "DELETE") {
    await handleClearAdminVisitors(request, response);
    return;
  }

  if (pathname === "/api/admin/mail-status" && request.method === "GET") {
    await handleGetAdminMailStatus(request, response);
    return;
  }

  if (pathname === "/api/users/lists" && request.method === "POST") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    await handleAddToUserList(
      request,
      response,
      String(body?.listType || ""),
      String(body?.concertId || ""),
    );
    return;
  }

  if (pathname.startsWith("/api/users/lists/") && request.method === "DELETE") {
    const pathPart = pathname.slice("/api/users/lists/".length);
    const firstSlash = pathPart.indexOf("/");

    if (firstSlash <= 0) {
      sendJson(response, 400, { error: "Ogiltig listväg." });
      return;
    }

    const listType = decodeURIComponent(pathPart.slice(0, firstSlash));
    const concertId = decodeURIComponent(pathPart.slice(firstSlash + 1));
    await handleRemoveFromUserList(request, response, listType, concertId);
    return;
  }

  if (pathname.startsWith("/api/sources/") && request.method === "DELETE") {
    const sourceId = decodeURIComponent(pathname.slice("/api/sources/".length));
    await handleDeleteSource(request, response, sourceId);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}
