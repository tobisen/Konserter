<script setup>
import flatpickr from "flatpickr";
import { Swedish } from "flatpickr/dist/l10n/sv.js";
import "flatpickr/dist/flatpickr.min.css";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  clearStoredConcerts,
  loadStoredConcerts,
  updateConcertsFromSources,
} from "./services/concertStore";
import {
  addSource,
  loadSourcesDetailed,
  removeSource,
} from "./services/sourceStore";
import {
  addUserFollow,
  addToUserList,
  getUserSession,
  loadUserFollows,
  loadUserLists,
  loadUserPreferences,
  changeUserPassword,
  loginUser,
  logoutUser,
  removeUserFollow,
  requestPasswordReset,
  registerUser,
  resetPassword,
  removeFromUserList,
  unsubscribeByToken,
  updateUserPreferences,
} from "./services/userStore";

const concerts = ref([]);
const lastUpdatedAt = ref(null);
const sources = ref([]);
const loading = ref(false);
const status = ref("");
const sourceStatus = ref("");
const sourceImportStatus = ref([]);
const fetchErrors = ref([]);
const adminSubView = ref("sources");
const adminUsers = ref([]);
const adminVisitors = ref([]);
const adminMailStatus = ref({ configured: false, mode: "logs_only" });
const adminUserDeleteId = ref("");
const popularItems = ref([]);
const popularLoading = ref(false);

const allowedViews = new Set([
  "home",
  "concerts",
  "my-concerts",
  "settings",
  "help",
  "contact",
  "sources",
  "admin",
  "unsubscribe",
]);

const viewToPath = {
  home: "/",
  concerts: "/spelningar",
  "my-concerts": "/mina-spelningar",
  settings: "/installningar",
  help: "/hjalp",
  contact: "/kontakt",
  sources: "/kallor",
  admin: "/admin",
  unsubscribe: "/unsubscribe",
};

const pathToView = Object.fromEntries(
  Object.entries(viewToPath).map(([view, path]) => [path, view]),
);

function normalizePathname(pathname) {
  const normalized = String(pathname || "").trim();
  if (!normalized || normalized === "/") return "/";
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function getViewFromCurrentUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const viewFromQuery = String(url.searchParams.get("view") || "").trim();
  if (allowedViews.has(viewFromQuery)) return viewFromQuery;
  const normalizedPath = normalizePathname(url.pathname);
  if (normalizedPath === "/unsubscribe" || normalizedPath === "/avprenumerera") {
    return "unsubscribe";
  }
  return pathToView[normalizedPath] || "";
}

function resolveInitialView() {
  if (typeof window === "undefined") return "home";
  const viewFromUrl = getViewFromCurrentUrl();
  if (viewFromUrl) return viewFromUrl;
  const saved = window.localStorage.getItem("soundcheck_view") || "";
  return allowedViews.has(saved) ? saved : "home";
}

const currentView = ref(resolveInitialView());
const showAuthModal = ref(false);
const locale = ref(
  typeof window !== "undefined" &&
    window.localStorage.getItem("soundcheck_locale") === "en"
    ? "en"
    : "sv",
);

const isAuthenticated = ref(false);
const authReady = ref(false);
const authError = ref("");
const loginUsername = ref("");
const loginPassword = ref("");
const showAdminLoginPassword = ref(false);
const authLoading = ref(false);

const appUser = ref(null);
const userAuthReady = ref(false);
const userError = ref("");
const userStatus = ref("");
const userLoginUsername = ref("");
const userLoginPassword = ref("");
const userRegisterUsername = ref("");
const userRegisterEmail = ref("");
const userRegisterPassword = ref("");
const showUserRegisterPassword = ref(false);
const showUserLoginPassword = ref(false);
const userLoading = ref(false);
const favoriteIds = ref([]);
const bookingIds = ref([]);
const seenIds = ref([]);
const followedArtists = ref([]);
const followedVenues = ref([]);
const userPreferences = ref({
  newsletterEnabled: true,
  reminderEmailsEnabled: true,
});
const preferencesSaving = ref(false);
const userPasswordCurrent = ref("");
const userPasswordNext = ref("");
const userPasswordConfirm = ref("");
const showUserPasswordCurrent = ref(false);
const showUserPasswordNext = ref(false);
const showUserPasswordConfirm = ref(false);
const userPasswordSaving = ref(false);
const myConcertsSubView = ref("favorites");
const favoritesSort = ref("date_asc");
const forgotEmail = ref("");
const resetToken = ref("");
const resetNewPassword = ref("");
const showResetNewPassword = ref(false);
const showResetForm = ref(false);
const newFavoriteArtistSuggestionConcerts = ref([]);
const contactName = ref("");
const contactEmail = ref("");
const contactMessage = ref("");
const contactSubmitting = ref(false);
const contactStatus = ref("");
const contactError = ref("");

const passwordCurrent = ref("");
const passwordNext = ref("");
const passwordConfirm = ref("");
const showPasswordCurrent = ref(false);
const showPasswordNext = ref(false);
const showPasswordConfirm = ref(false);
const passwordLoading = ref(false);
const passwordStatus = ref("");

const newSourceName = ref("");
const newSourceUrl = ref("");
const deselectedSources = ref([]);
const deselectedMonths = ref([]);
const deselectedGenres = ref([]);
const concertsSearch = ref("");
const concertsDateTo = ref("");
const quickDiscoverMode = ref("all");
const concertsListView = ref("cards");
const homeListView = ref("cards");
const concertsDateToInput = ref(null);
const filtersModalOpen = ref(false);
const concertsSubView = ref("upcoming");
const sharedConcertId = ref("");
const shareStatus = ref("");
const isMenuOpen = ref(false);
const unsubscribeToken = ref("");
const unsubscribeLoading = ref(false);
const unsubscribeStatus = ref("");
const unsubscribeError = ref("");
let concertsDateToPicker = null;

const quickDiscoverOptions = computed(() => [
  { id: "all", label: locale.value === "en" ? "All" : "Alla" },
  { id: "week", label: locale.value === "en" ? "This week" : "Denna vecka" },
  { id: "weekend", label: locale.value === "en" ? "This weekend" : "I helgen" },
]);

const i18n = {
  sv: {
    nav: {
      home: "Hem",
      concerts: "Spelningar",
      myConcerts: "Mina Spelningar",
      settings: "Inställningar",
      help: "Hjälp",
      contact: "Kontakt",
      sources: "Källor",
      admin: "Admin",
      login: "Logga in",
      logout: "Logga ut",
    },
    labels: {
      version: "Version",
      lastUpdated: "Senast uppdaterad",
      loadingAuth: "Laddar inloggningsstatus...",
    },
    home: {
      title: "Soundcheck",
      lead:
        "Hitta de bästa spelningarna snabbare. Soundcheck samlar konserter från flera källor på ett ställe, så du slipper leta runt och kan fokusera på att upptäcka nytt, spara favoriter och aldrig missa en kväll värd att gå på.",
      monthHeading: "Spelningar i {month}",
      noMonthConcerts: "Inga spelningar hittades för aktuell månad.",
    },
    actions: {
      going: "Ska gå",
      seen: "Var där",
      addCalendar: "Kalender",
      shareConcert: "Dela",
      play: "♫",
      followArtist: "Följ artist",
      followingArtist: "Följer artist",
      followVenue: "Följ scen",
      followingVenue: "Följer scen",
      readMore: "Läs mer",
      openMyConcerts: "Öppna Mina Spelningar",
    },
    misc: {
      unknownSource: "Okänd källa",
      otherGenre: "Övrigt",
      neverUpdated: "Har inte uppdaterats ännu",
      unknownTime: "Okänd tidpunkt",
      unknown: "Okänd",
      copyLinkPrompt: "Kopiera länken:",
      unknownArtist: "Okänd artist",
      unknownDate: "Okänt datum",
      unknownVenue: "Okänd scen",
    },
    contact: {
      title: "Kontakt",
      lead:
        "Skicka gärna feedback, felrapport eller förslag så svarar vi så fort vi kan.",
      name: "Namn",
      email: "E-post",
      message: "Meddelande",
      submit: "Skicka",
      submitting: "Skickar...",
    },
  },
  en: {
    nav: {
      home: "Home",
      concerts: "Concerts",
      myConcerts: "My Concerts",
      settings: "Settings",
      help: "Help",
      contact: "Contact",
      sources: "Sources",
      admin: "Admin",
      login: "Log in",
      logout: "Log out",
    },
    labels: {
      version: "Version",
      lastUpdated: "Last updated",
      loadingAuth: "Loading sign-in status...",
    },
    home: {
      title: "Soundcheck",
      lead:
        "Find the best live shows faster. Soundcheck collects concerts from multiple sources in one place, so you can skip searching and focus on discovering new artists, saving favorites, and never missing a great night out.",
      monthHeading: "Concerts in {month}",
      noMonthConcerts: "No concerts found for the current month.",
    },
    actions: {
      going: "Going",
      seen: "Seen",
      addCalendar: "Calendar",
      shareConcert: "Share",
      play: "♫",
      followArtist: "Follow artist",
      followingArtist: "Following artist",
      followVenue: "Follow venue",
      followingVenue: "Following venue",
      readMore: "Read more",
      openMyConcerts: "Open My Concerts",
    },
    misc: {
      unknownSource: "Unknown source",
      otherGenre: "Other",
      neverUpdated: "Not updated yet",
      unknownTime: "Unknown time",
      unknown: "Unknown",
      copyLinkPrompt: "Copy link:",
      unknownArtist: "Unknown artist",
      unknownDate: "Unknown date",
      unknownVenue: "Unknown venue",
    },
    contact: {
      title: "Contact",
      lead:
        "Send feedback, bug reports, or ideas and we will reply as soon as possible.",
      name: "Name",
      email: "Email",
      message: "Message",
      submit: "Send",
      submitting: "Sending...",
    },
  },
};

function t(path, params = {}) {
  const parts = String(path).split(".");
  let value = i18n[locale.value];
  let fallback = i18n.sv;
  for (const part of parts) {
    value = value?.[part];
    fallback = fallback?.[part];
  }
  let text = String(value ?? fallback ?? path);
  for (const [key, paramValue] of Object.entries(params)) {
    text = text.replaceAll(`{${key}}`, String(paramValue));
  }
  return text;
}

function upsertMeta(selector, attribute, value) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, selector.includes('property="') ? selector.match(/property="([^"]+)"/)?.[1] || "" : selector.match(/name="([^"]+)"/)?.[1] || "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(url) {
  if (typeof document === "undefined") return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function getSeoForView(view) {
  const isEn = locale.value === "en";
  const titles = {
    home: isEn ? "Soundcheck | Live Music in Uppsala" : "Soundcheck | Spelningar i Uppsala",
    concerts: isEn ? "Concerts | Soundcheck" : "Spelningar | Soundcheck",
    "my-concerts": isEn ? "My Concerts | Soundcheck" : "Mina Spelningar | Soundcheck",
    settings: isEn ? "Settings | Soundcheck" : "Inställningar | Soundcheck",
    help: isEn ? "Help | Soundcheck" : "Hjälp | Soundcheck",
    contact: isEn ? "Contact | Soundcheck" : "Kontakt | Soundcheck",
    sources: isEn ? "Sources | Soundcheck" : "Källor | Soundcheck",
    admin: "Admin | Soundcheck",
    unsubscribe: isEn ? "Unsubscribe | Soundcheck" : "Avprenumerera | Soundcheck",
  };
  const descriptions = {
    home: isEn
      ? "Soundcheck collects concerts and live music in one place so you can discover more, faster."
      : "Soundcheck samlar konserter och spelningar på ett ställe så du hittar nästa kväll snabbare.",
    concerts: isEn
      ? "Browse upcoming and past concerts. Filter by source, month, genre and date."
      : "Bläddra bland kommande och tidigare spelningar. Filtrera på källa, månad, genre och datum.",
    "my-concerts": isEn
      ? "Save favorites, mark bookings and track seen concerts."
      : "Spara favoriter, markera bokningar och håll koll på sedda spelningar.",
    settings: isEn
      ? "Manage account email and password settings."
      : "Hantera kontots e-post- och lösenordsinställningar.",
    help: isEn ? "How Soundcheck works." : "Så fungerar Soundcheck.",
    contact: isEn ? "Send feedback or suggestions to Soundcheck." : "Skicka feedback eller förslag till Soundcheck.",
    sources: isEn ? "See active concert sources used by Soundcheck." : "Se aktiva källor som används av Soundcheck.",
    admin: isEn ? "Admin tools for Soundcheck." : "Adminverktyg för Soundcheck.",
    unsubscribe: isEn ? "Unsubscribe from email updates." : "Avprenumerera från e-postutskick.",
  };
  return {
    title: titles[view] || "Soundcheck",
    description: descriptions[view] || descriptions.home,
  };
}

function updateSeo() {
  if (typeof window === "undefined") return;
  const seo = getSeoForView(currentView.value);
  document.title = seo.title;
  upsertMeta('meta[name="description"]', "name", seo.description);
  upsertMeta('meta[property="og:title"]', "property", seo.title);
  upsertMeta('meta[property="og:description"]', "property", seo.description);
  upsertMeta('meta[property="og:url"]', "property", window.location.href);
  upsertMeta('meta[name="twitter:title"]', "name", seo.title);
  upsertMeta('meta[name="twitter:description"]', "name", seo.description);
  setCanonical(window.location.href);
}

function setLocale(nextLocale) {
  locale.value = nextLocale;
}

function initConcertsDateToPicker() {
  if (!concertsDateToInput.value || concertsDateToPicker) return;

  concertsDateToPicker = flatpickr(concertsDateToInput.value, {
    locale: locale.value === "en" ? undefined : Swedish,
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "j F Y",
    allowInput: false,
    onChange: (selectedDates, dateStr) => {
      concertsDateTo.value = dateStr || "";
    },
    onDayCreate: (_dObj, _dStr, _fp, dayElem) => {
      const dateObj = dayElem?.dateObj;
      if (!dateObj) return;
      const dayKey = toLocalDateKey(dateObj);
      if (concertDayKeySetForCurrentView.value.has(dayKey)) {
        dayElem.classList.add("has-event-day");
      }
    },
  });
}

function destroyConcertsDateToPicker() {
  concertsDateToPicker?.destroy();
  concertsDateToPicker = null;
}

// Spotify modal
const showSpotifyModal = ref(false);
const spotifyArtist = ref("");
const spotifyData = ref(null);
const spotifyLoading = ref(false);
const spotifyError = ref("");

const monthFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value === "en" ? "en-GB" : "sv-SE", {
      month: "long",
    }),
);
const monthYearFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value === "en" ? "en-GB" : "sv-SE", {
      month: "long",
      year: "numeric",
    }),
);
const appVersion = __APP_VERSION__;
const appBuildAt = __APP_BUILD_AT__;
const updatedAtFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value === "en" ? "en-GB" : "sv-SE", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
);

function getConcertDate(concert) {
  const date = new Date(concert?.date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getConcertId(concert) {
  const date = getConcertDate(concert);
  if (!date) return "";

  return [
    normalizeText(concert.artist),
    normalizeText(concert.venue),
    normalizeText(concert.city),
    date.toISOString(),
  ].join("|");
}

function getConcertSourceName(concert) {
  const sourceName = String(concert?.sourceName || "").trim();
  return sourceName || t("misc.unknownSource");
}

function getConcertGenre(concert) {
  return String(concert?.genre || "").trim();
}

function getConcertGenreLabel(concert) {
  const genre = getConcertGenre(concert);
  return genre || t("misc.otherGenre");
}

function getConcertDetailsUrl(concert) {
  return String(concert?.detailsUrl || "").trim();
}

function getSourceUrlByName(sourceName) {
  const normalized = String(sourceName || "").trim().toLowerCase();
  if (!normalized) return "";
  const match = sources.value.find(
    (source) => String(source?.name || "").trim().toLowerCase() === normalized,
  );
  return String(match?.url || "").trim();
}

function getConcertReadMoreUrl(concert) {
  const detailsUrl = getConcertDetailsUrl(concert);
  if (detailsUrl) return detailsUrl;
  return getSourceUrlByName(getConcertSourceName(concert));
}

function getConcertImageUrl(concert) {
  return String(concert?.imageUrl || "").trim();
}

function getConcertDisplayImageUrl(concert) {
  return getConcertImageUrl(concert) || "/default_artist.jpg";
}

function getMonthLabel(monthNumber) {
  return monthFormatter.value.format(new Date(Date.UTC(2024, monthNumber, 1)));
}

function syncBrowserRoute(view, replaceUrl = false) {
  if (typeof window === "undefined") return;
  const targetPath = viewToPath[view] || "/";
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  url.pathname = targetPath;
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  if (replaceUrl) {
    window.history.replaceState({}, "", nextUrl);
    return;
  }
  window.history.pushState({}, "", nextUrl);
}

function setView(view, options = {}) {
  if (!allowedViews.has(view)) return;
  const { syncUrl = true, replaceUrl = false } = options;
  currentView.value = view;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("soundcheck_view", view);
    if (syncUrl) {
      syncBrowserRoute(view, replaceUrl);
    }
  }

  if (view === "admin" && isAuthenticated.value) {
    loadAdminCounters();
    setAdminSubView(adminSubView.value);
  }
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

function handleBrowserPopState() {
  const viewFromUrl = getViewFromCurrentUrl();
  setView(viewFromUrl || "home", { syncUrl: false });
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    closeMenu();
    closeFiltersModal();
    document
      .querySelectorAll(".card-menu[open], .table-row-menu[open]")
      .forEach((menu) => {
        menu.removeAttribute("open");
      });
  }
}

function handleGlobalPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".card-menu") || target.closest(".table-row-menu")) return;

  document
    .querySelectorAll(".card-menu[open], .table-row-menu[open]")
    .forEach((menu) => {
      menu.removeAttribute("open");
    });
}

function navigateTo(view) {
  setView(view);
  closeMenu();
}

async function handleMenuAdmin() {
  closeMenu();
  await handleAdminButton();
}

async function handleMenuAuth() {
  closeMenu();
  if (userAuthenticated.value) {
    await logoutRegularUser();
    return;
  }
  setView("my-concerts");
}

function setConcertsSubView(view) {
  concertsSubView.value = view;
}

function setConcertsListView(view) {
  concertsListView.value = view;
}

function openFiltersModal() {
  filtersModalOpen.value = true;
}

function closeFiltersModal() {
  filtersModalOpen.value = false;
}

function openAuthModal() {
  authError.value = "";
  showAuthModal.value = true;
}

function closeAuthModal() {
  showAuthModal.value = false;
}

async function handleAdminButton() {
  setView("admin");

  if (!isAuthenticated.value) {
    openAuthModal();
  }
}

const userAuthenticated = computed(() => Boolean(appUser.value));
const formattedLastUpdatedAt = computed(() => {
  if (!appBuildAt) return t("misc.neverUpdated");
  const date = new Date(appBuildAt);
  if (Number.isNaN(date.getTime())) return t("misc.unknownTime");
  return updatedAtFormatter.value.format(date);
});

const displayVersion = computed(
  () => `v.${String(appVersion).replace("+build.", "-")}`,
);

function getConcertMonth(concert) {
  const date = getConcertDate(concert);
  return date ? date.getMonth() : null;
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const currentMonthLabel = computed(() => {
  return monthYearFormatter.value.format(new Date());
});

function getStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function isPastConcert(concert) {
  const date = getConcertDate(concert);
  if (!date) return false;
  return date < getStartOfToday();
}

function isUpcomingConcert(concert) {
  const date = getConcertDate(concert);
  if (!date) return false;
  return date >= getStartOfToday();
}

const currentMonthConcerts = computed(() => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const startOfToday = getStartOfToday();

  return concerts.value
    .filter((concert) => {
      const date = getConcertDate(concert);
      return (
        date &&
        date.getMonth() === month &&
        date.getFullYear() === year &&
        date >= startOfToday
      );
    })
    .sort((a, b) => getConcertDate(a) - getConcertDate(b));
});

const concertsForCurrentView = computed(() => {
  if (concertsSubView.value === "past") {
    return concerts.value.filter((concert) => isPastConcert(concert));
  }

  return concerts.value.filter((concert) => isUpcomingConcert(concert));
});

const availableSourceNames = computed(() => {
  return [
    ...new Set(
      concertsForCurrentView.value.map((concert) =>
        getConcertSourceName(concert),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "sv-SE"));
});

const availableMonthNumbers = computed(() => {
  const months = concertsForCurrentView.value
    .map((concert) => getConcertMonth(concert))
    .filter((month) => month !== null);

  return [...new Set(months)].sort((a, b) => a - b);
});

const availableGenreLabels = computed(() => {
  const genres = [
    ...new Set(
      concertsForCurrentView.value.map((concert) =>
        getConcertGenreLabel(concert),
      ),
    ),
  ];

  return genres.sort((a, b) => {
    const other = t("misc.otherGenre");
    if (a === other && b !== other) return 1;
    if (b === other && a !== other) return -1;
    return a.localeCompare(b, locale.value === "en" ? "en-GB" : "sv-SE");
  });
});

function getConcertSearchableText(concert) {
  return normalizeText(
    [
      concert?.artist || "",
      concert?.title || "",
      concert?.venue || "",
      concert?.city || "",
      concert?.genre || "",
      concert?.sourceName || "",
      concert?.detailsUrl || "",
    ].join(" "),
  );
}

function getWeekRange(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const dayOffset = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayOffset);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekendRange(referenceDate = new Date()) {
  const { start } = getWeekRange(referenceDate);
  const weekendStart = new Date(start);
  weekendStart.setDate(weekendStart.getDate() + 4);
  weekendStart.setHours(17, 0, 0, 0);

  const weekendEnd = new Date(start);
  weekendEnd.setDate(weekendEnd.getDate() + 6);
  weekendEnd.setHours(23, 59, 59, 999);
  return { start: weekendStart, end: weekendEnd };
}

function matchesQuickDiscoverFilter(concert, mode) {
  if (mode === "all") return true;

  const date = getConcertDate(concert);
  if (!date && (mode === "week" || mode === "weekend")) return false;

  if (mode === "week") {
    const { start, end } = getWeekRange();
    return date >= start && date <= end;
  }

  if (mode === "weekend") {
    const { start, end } = getWeekendRange();
    return date >= start && date <= end;
  }

  return true;
}

const filteredConcertsBase = computed(() => {
  const query = normalizeText(concertsSearch.value);
  const selectedDateKey = concertsDateTo.value || null;

  return concertsForCurrentView.value.filter((concert) => {
    const sourceIncluded = !deselectedSources.value.includes(
      getConcertSourceName(concert),
    );
    const month = getConcertMonth(concert);
    const monthIncluded =
      month === null || !deselectedMonths.value.includes(month);
    const genreIncluded = !deselectedGenres.value.includes(
      getConcertGenreLabel(concert),
    );
    const searchable = getConcertSearchableText(concert);
    const searchIncluded = !query || searchable.includes(query);
    const concertDate = getConcertDate(concert);
    const dateIncluded =
      !selectedDateKey ||
      (concertDate && toLocalDateKey(concertDate) === selectedDateKey);

    return sourceIncluded && monthIncluded && genreIncluded && searchIncluded && dateIncluded;
  });
});

const quickFilterCounts = computed(() => {
  const base = filteredConcertsBase.value;
  return {
    all: base.length,
    week: base.filter((concert) => matchesQuickDiscoverFilter(concert, "week"))
      .length,
    weekend: base.filter((concert) =>
      matchesQuickDiscoverFilter(concert, "weekend"),
    ).length,
  };
});

const filteredConcerts = computed(() => {
  if (sharedConcertId.value) {
    const shared = concerts.value.find(
      (concert) => getConcertId(concert) === sharedConcertId.value,
    );
    return shared ? [shared] : [];
  }

  return filteredConcertsBase.value.filter((concert) =>
    matchesQuickDiscoverFilter(concert, quickDiscoverMode.value),
  );
});

const sortedFilteredConcerts = computed(() => {
  return [...filteredConcerts.value].sort((a, b) =>
    concertsSubView.value === "past"
      ? getConcertDate(b) - getConcertDate(a)
      : getConcertDate(a) - getConcertDate(b),
  );
});

const popularThisWeekConcerts = computed(() => {
  if (concertsSubView.value !== "upcoming" || sharedConcertId.value) return [];

  const { start, end } = getWeekRange();
  const byId = new Map(
    (popularItems.value || []).map((item) => [String(item?.concertId || ""), item]),
  );

  return concerts.value
    .filter((concert) => {
      const concertId = getConcertId(concert);
      const date = getConcertDate(concert);
      if (!concertId || !date) return false;
      if (date < start || date > end) return false;
      const stats = byId.get(concertId);
      return Boolean(stats && Number(stats.score || 0) > 0);
    })
    .map((concert) => ({
      concert,
      stats: byId.get(getConcertId(concert)),
      date: getConcertDate(concert),
    }))
    .sort(
      (a, b) =>
        Number(b.stats?.score || 0) - Number(a.stats?.score || 0) ||
        Number(b.stats?.bookings || 0) - Number(a.stats?.bookings || 0) ||
        Number(a.date || 0) - Number(b.date || 0),
    )
    .slice(0, 5);
});

const groupedByYearAndMonth = computed(() => {
  const yearGroups = new Map();

  for (const concert of filteredConcerts.value) {
    const date = getConcertDate(concert);
    if (!date) continue;

    const year = date.getFullYear();
    const month = date.getMonth();

    if (!yearGroups.has(year)) {
      yearGroups.set(year, new Map());
    }

    const monthGroups = yearGroups.get(year);

    if (!monthGroups.has(month)) {
      monthGroups.set(month, []);
    }

    monthGroups.get(month).push(concert);
  }

  return [...yearGroups.entries()]
    .sort((a, b) =>
      concertsSubView.value === "past" ? b[0] - a[0] : a[0] - b[0],
    )
    .map(([year, monthGroups]) => ({
      year,
      months: [...monthGroups.entries()]
        .sort((a, b) =>
          concertsSubView.value === "past" ? b[0] - a[0] : a[0] - b[0],
        )
        .map(([month, items]) => ({
          month,
          label: getMonthLabel(month),
          concerts: [...items].sort((a, b) =>
            concertsSubView.value === "past"
              ? getConcertDate(b) - getConcertDate(a)
              : getConcertDate(a) - getConcertDate(b),
          ),
        })),
    }));
});

const concertDayKeySetForCurrentView = computed(() => {
  const keys = concertsForCurrentView.value
    .map((concert) => getConcertDate(concert))
    .filter(Boolean)
    .map((date) => toLocalDateKey(date));

  return new Set(keys);
});

const sharedConcert = computed(() => {
  if (!sharedConcertId.value) return null;
  return (
    concerts.value.find(
      (concert) => getConcertId(concert) === sharedConcertId.value,
    ) || null
  );
});

const favoriteConcerts = computed(() => {
  if (!favoriteIds.value.length) return [];

  const favoriteSet = new Set(favoriteIds.value);
  return concerts.value
    .filter((concert) => favoriteSet.has(getConcertId(concert)))
    .sort((a, b) => getConcertDate(a) - getConcertDate(b));
});

function sortConcerts(concertList, sortMode) {
  const list = [...concertList];

  if (sortMode === "date_desc") {
    return list.sort((a, b) => getConcertDate(b) - getConcertDate(a));
  }

  if (sortMode === "artist_asc") {
    return list.sort((a, b) =>
      String(a.artist || "").localeCompare(String(b.artist || ""), "sv-SE"),
    );
  }

  if (sortMode === "city_asc") {
    return list.sort((a, b) =>
      String(a.city || "").localeCompare(String(b.city || ""), "sv-SE"),
    );
  }

  return list.sort((a, b) => getConcertDate(a) - getConcertDate(b));
}

const sortedFavoriteConcerts = computed(() => {
  return sortConcerts(favoriteConcerts.value, favoritesSort.value);
});

const bookingConcerts = computed(() => {
  if (!bookingIds.value.length) return [];

  const bookingSet = new Set(bookingIds.value);
  return concerts.value
    .filter((concert) => bookingSet.has(getConcertId(concert)))
    .sort((a, b) => getConcertDate(a) - getConcertDate(b));
});

const seenConcerts = computed(() => {
  if (!seenIds.value.length) return [];

  const seenSet = new Set(seenIds.value);
  return concerts.value
    .filter((concert) => seenSet.has(getConcertId(concert)))
    .sort((a, b) => getConcertDate(b) - getConcertDate(a));
});

const myConcertsBySubView = computed(() => {
  if (myConcertsSubView.value === "bookings") return bookingConcerts.value;
  if (myConcertsSubView.value === "seen") return seenConcerts.value;
  return sortedFavoriteConcerts.value;
});

const followedReleaseConcerts = computed(() => {
  if (!followedArtists.value.length && !followedVenues.value.length) return [];

  const artistSet = new Set(followedArtists.value.map((item) => normalizeText(item)));
  const venueSet = new Set(followedVenues.value.map((item) => normalizeText(item)));
  const startOfToday = getStartOfToday();

  return concerts.value
    .filter((concert) => {
      const date = getConcertDate(concert);
      if (!date || date < startOfToday) return false;
      const artistMatch = artistSet.has(normalizeText(concert.artist));
      const venueMatch = venueSet.has(normalizeText(concert.venue));
      return artistMatch || venueMatch;
    })
    .sort((a, b) => getConcertDate(a) - getConcertDate(b))
    .slice(0, 20);
});

const favoriteArtistSuggestionConcerts = computed(() => {
  if (!favoriteConcerts.value.length) return [];

  const favoriteArtistSet = new Set(
    favoriteConcerts.value
      .map((concert) => normalizeText(concert.artist))
      .filter(Boolean),
  );

  const favoriteIdSet = new Set(favoriteIds.value);
  const upcomingSuggestions = concerts.value.filter((concert) => {
    const concertId = getConcertId(concert);
    const date = getConcertDate(concert);
    if (!concertId || !date) return false;
    if (favoriteIdSet.has(concertId)) return false;
    if (date < getStartOfToday()) return false;
    return favoriteArtistSet.has(normalizeText(concert.artist));
  });

  return sortConcerts(upcomingSuggestions, "date_asc");
});

function syncFavoriteArtistNotifications() {
  const storageKey = "konsertnavigator_seen_favorite_artist_concert_ids_v1";
  let seenIdsFromStorage = new Set();

  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    seenIdsFromStorage = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    seenIdsFromStorage = new Set();
  }

  const newConcerts = favoriteArtistSuggestionConcerts.value.filter(
    (concert) => {
      const id = getConcertId(concert);
      return id && !seenIdsFromStorage.has(id);
    },
  );

  newFavoriteArtistSuggestionConcerts.value = newConcerts;
}

function markFavoriteArtistNotificationsSeen() {
  const storageKey = "konsertnavigator_seen_favorite_artist_concert_ids_v1";
  const suggestionIds = favoriteArtistSuggestionConcerts.value
    .map((concert) => getConcertId(concert))
    .filter(Boolean);

  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const merged = new Set([
      ...(Array.isArray(parsed) ? parsed : []),
      ...suggestionIds,
    ]);
    localStorage.setItem(storageKey, JSON.stringify([...merged]));
  } catch {
    // Ignore localStorage errors
  }

  newFavoriteArtistSuggestionConcerts.value = [];
}

function isFavorite(concert) {
  const id = getConcertId(concert);
  return Boolean(id) && favoriteIds.value.includes(id);
}

function isBooked(concert) {
  const id = getConcertId(concert);
  return Boolean(id) && bookingIds.value.includes(id);
}

function isSeen(concert) {
  const id = getConcertId(concert);
  return Boolean(id) && seenIds.value.includes(id);
}

function applyUserLists(lists) {
  favoriteIds.value = lists.favorites || [];
  bookingIds.value = lists.bookings || [];
  seenIds.value = lists.seen || [];
  followedArtists.value = lists.followedArtists || [];
  followedVenues.value = lists.followedVenues || [];
}

function applyUserPreferences(preferences) {
  userPreferences.value = {
    newsletterEnabled: preferences?.newsletterEnabled !== false,
    reminderEmailsEnabled: preferences?.reminderEmailsEnabled !== false,
  };
}

function isFollowedArtist(artistName) {
  const normalized = normalizeText(artistName);
  if (!normalized) return false;
  return followedArtists.value.some((item) => normalizeText(item) === normalized);
}

function isFollowedVenue(venueName) {
  const normalized = normalizeText(venueName);
  if (!normalized) return false;
  return followedVenues.value.some((item) => normalizeText(item) === normalized);
}

async function toggleFollowArtist(artistName) {
  if (!userAuthenticated.value) {
    const message = "Du behöver logga in eller registrera dig för att följa artister.";
    userStatus.value = message;
    window.alert(message);
    setView("my-concerts");
    return;
  }

  const value = String(artistName || "").trim();
  if (!value) return;
  const wasFollowed = isFollowedArtist(value);

  try {
    const follows = wasFollowed
      ? await removeUserFollow("artist", value)
      : await addUserFollow("artist", value);
    followedArtists.value = follows.followedArtists || [];
    followedVenues.value = follows.followedVenues || followedVenues.value;
    userStatus.value = wasFollowed
      ? `Följer inte längre ${value}.`
      : `Följer nu ${value}.`;
  } catch (error) {
    userStatus.value = error.message || "Kunde inte uppdatera följning.";
  }
}

async function toggleFollowVenue(venueName) {
  if (!userAuthenticated.value) {
    const message = "Du behöver logga in eller registrera dig för att följa scener.";
    userStatus.value = message;
    window.alert(message);
    setView("my-concerts");
    return;
  }

  const value = String(venueName || "").trim();
  if (!value) return;
  const wasFollowed = isFollowedVenue(value);

  try {
    const follows = wasFollowed
      ? await removeUserFollow("venue", value)
      : await addUserFollow("venue", value);
    followedArtists.value = follows.followedArtists || followedArtists.value;
    followedVenues.value = follows.followedVenues || [];
    userStatus.value = wasFollowed
      ? `Följer inte längre ${value}.`
      : `Följer nu ${value}.`;
  } catch (error) {
    userStatus.value = error.message || "Kunde inte uppdatera följning.";
  }
}

async function toggleFavorite(concert) {
  if (!userAuthenticated.value) {
    const message =
      "Du behöver logga in eller registrera dig för att spara favoriter.";
    userStatus.value = message;
    window.alert(message);
    setView("my-concerts");
    return;
  }

  const concertId = getConcertId(concert);
  if (!concertId) return;

  try {
    if (isFavorite(concert)) {
      const lists = await removeFromUserList("favorites", concertId);
      applyUserLists(lists);
      userStatus.value = "Tog bort spelning från favoriter.";
      await refreshPopularConcerts();
      return;
    }

    const lists = await addToUserList("favorites", concertId);
    applyUserLists(lists);
    userStatus.value = "Spelning sparad i favoriter.";
    await refreshPopularConcerts();
  } catch (error) {
    userStatus.value = error.message || "Kunde inte uppdatera favoriter.";
  }
}

async function toggleBooking(concert) {
  if (!userAuthenticated.value) {
    const message =
      "Du behöver logga in eller registrera dig för att hantera bokningar.";
    userStatus.value = message;
    window.alert(message);
    setView("my-concerts");
    return;
  }

  const concertId = getConcertId(concert);
  if (!concertId) return;

  try {
    const wasBooked = isBooked(concert);
    const lists = wasBooked
      ? await removeFromUserList("bookings", concertId)
      : await addToUserList("bookings", concertId);
    applyUserLists(lists);
    userStatus.value = wasBooked
      ? "Tog bort spelning från bokningar."
      : "Spelning lagd i bokningar.";
    await refreshPopularConcerts();
  } catch (error) {
    userStatus.value = error.message || "Kunde inte uppdatera bokningar.";
  }
}

async function toggleSeen(concert) {
  if (!userAuthenticated.value) {
    const message =
      "Du behöver logga in eller registrera dig för att hantera sedda spelningar.";
    userStatus.value = message;
    window.alert(message);
    setView("my-concerts");
    return;
  }

  const concertId = getConcertId(concert);
  if (!concertId) return;

  try {
    const wasSeen = isSeen(concert);
    const lists = wasSeen
      ? await removeFromUserList("seen", concertId)
      : await addToUserList("seen", concertId);
    applyUserLists(lists);
    userStatus.value = wasSeen
      ? "Tog bort spelning från sedda."
      : "Spelning lagd i sedda.";
  } catch (error) {
    userStatus.value =
      error.message || "Kunde inte uppdatera sedda spelningar.";
  }
}

function isSourceSelected(sourceName) {
  return !deselectedSources.value.includes(sourceName);
}

function toggleSourceFilter(sourceName) {
  if (isSourceSelected(sourceName)) {
    deselectedSources.value = [...deselectedSources.value, sourceName];
    return;
  }

  deselectedSources.value = deselectedSources.value.filter(
    (name) => name !== sourceName,
  );
}

function selectAllSources() {
  deselectedSources.value = [];
}

function deselectAllSources() {
  deselectedSources.value = [...availableSourceNames.value];
}

function isMonthSelected(monthNumber) {
  return !deselectedMonths.value.includes(monthNumber);
}

function toggleMonthFilter(monthNumber) {
  if (isMonthSelected(monthNumber)) {
    deselectedMonths.value = [...deselectedMonths.value, monthNumber];
    return;
  }

  deselectedMonths.value = deselectedMonths.value.filter(
    (value) => value !== monthNumber,
  );
}

function selectAllMonths() {
  deselectedMonths.value = [];
}

function deselectAllMonths() {
  deselectedMonths.value = [...availableMonthNumbers.value];
}

function isGenreSelected(genreLabel) {
  return !deselectedGenres.value.includes(genreLabel);
}

function toggleGenreFilter(genreLabel) {
  if (isGenreSelected(genreLabel)) {
    deselectedGenres.value = [...deselectedGenres.value, genreLabel];
    return;
  }

  deselectedGenres.value = deselectedGenres.value.filter(
    (value) => value !== genreLabel,
  );
}

function selectAllGenres() {
  deselectedGenres.value = [];
}

function deselectAllGenres() {
  deselectedGenres.value = [...availableGenreLabels.value];
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-GB" : "sv-SE", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function formatStatusDate(value) {
  if (!value) return t("misc.neverUpdated");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("misc.unknown");
  return updatedAtFormatter.value.format(date);
}

function buildSharedConcertUrl(concert) {
  const concertId = getConcertId(concert);
  if (!concertId) return window.location.href;

  const url = new URL(window.location.href);
  url.searchParams.set("concert", concertId);
  url.searchParams.set("view", "concerts");
  return url.toString();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push("");

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + (lines.length - 1) * lineHeight;
}

async function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function buildConcertPreviewBlob(concert) {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#0f1013");
  background.addColorStop(1, "#1f1212");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.86, height * 0.14, 20, width * 0.86, height * 0.14, 320);
  glow.addColorStop(0, "rgba(255, 59, 48, 0.32)");
  glow.addColorStop(1, "rgba(255, 59, 48, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const imageUrl = getConcertImageUrl(concert);
  if (imageUrl) {
    try {
      const image = await loadImageElement(imageUrl);
      const imgW = 300;
      const imgH = 300;
      const x = width - imgW - 56;
      const y = 56;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, imgW, imgH, 22);
      ctx.clip();
      ctx.drawImage(image, x, y, imgW, imgH);
      ctx.restore();
    } catch {
      // Ignore image errors (CORS or unavailable image).
    }
  }

  ctx.fillStyle = "#ff8a00";
  ctx.font = "700 28px 'Barlow Condensed', sans-serif";
  ctx.fillText("SOUNDCHECK", 56, 74);

  const artist = concert?.artist || t("misc.unknownArtist");
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 68px 'Barlow Condensed', sans-serif";
  const titleBottom = drawWrappedText(ctx, artist, 56, 170, 760, 72, 3);

  ctx.fillStyle = "#d6deef";
  ctx.font = "500 36px 'Barlow Condensed', sans-serif";
  const dateLabel = concert?.date ? formatDate(concert.date) : t("misc.unknownDate");
  ctx.fillText(dateLabel, 56, titleBottom + 78);

  const venueLabel = `${concert?.venue || t("misc.unknownVenue")}${concert?.city ? `, ${concert.city}` : ""}`;
  ctx.fillStyle = "#72d4ff";
  ctx.font = "700 34px 'Barlow Condensed', sans-serif";
  ctx.fillText(venueLabel, 56, titleBottom + 128);

  ctx.strokeStyle = "rgba(255, 138, 0, 0.8)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), "image/png", 0.92);
  });
}

function downloadPreviewBlob(blob, concert) {
  const artist = normalizeText(concert?.artist || "spelning").replace(/\s+/g, "-");
  const fileName = `soundcheck-${artist || "spelning"}.png`;
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
}

async function copyShareUrl(shareUrl) {
  try {
    await navigator.clipboard.writeText(shareUrl);
    return true;
  } catch {
    window.prompt(t("misc.copyLinkPrompt"), shareUrl);
    return false;
  }
}

async function shareConcert(concert) {
  const shareUrl = buildSharedConcertUrl(concert);
  const title = `${concert?.artist || "Spelning"} – ${concert?.venue || "Okänd scen"}`;
  const text = "Kolla in den här spelningen i Soundcheck";
  const copied = await copyShareUrl(shareUrl);
  const previewBlob = await buildConcertPreviewBlob(concert);
  const previewFile =
    previewBlob && typeof File !== "undefined"
      ? new File([previewBlob], "soundcheck-preview.png", { type: "image/png" })
      : null;

  try {
    if (
      navigator.share &&
      previewFile &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [previewFile] })
    ) {
      await navigator.share({
        title,
        text,
        url: shareUrl,
        files: [previewFile],
      });
      shareStatus.value = copied
        ? "Länk kopierad och spelning delad med preview-bild."
        : "Spelning delad med preview-bild.";
      return;
    }
  } catch {
    // Continue with fallback below.
  }

  if (previewBlob) {
    downloadPreviewBlob(previewBlob, concert);
    shareStatus.value = copied
      ? "Länk kopierad och preview-bild nedladdad."
      : "Preview-bild nedladdad. Kopiera länken från dialogen.";
    return;
  }

  shareStatus.value = copied ? "Länk kopierad." : "Delningslänk skapad.";
}

async function handleSharedConcertCta() {
  if (!sharedConcert.value) return;
  await toggleFavorite(sharedConcert.value);
}

function clearSharedConcertMode() {
  sharedConcertId.value = "";
  const url = new URL(window.location.href);
  url.searchParams.delete("concert");
  url.searchParams.delete("view");
  window.history.replaceState({}, "", url.toString());
}

function clearConcertsDateTo() {
  concertsDateTo.value = "";
  concertsDateToPicker?.clear();
}

async function trackVisitor() {
  try {
    await fetch("/api/visitors/ping", { method: "POST" });
  } catch {
    // Ignore visitor tracking errors in UI.
  }
}

async function loadAdminUsers() {
  const response = await fetch("/api/admin/users");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "Kunde inte läsa användare.");
  adminUsers.value = payload.users || [];
}

async function deleteAdminUser(user) {
  const userId = String(user?.id || "").trim();
  const username = String(user?.username || "").trim();
  if (!userId) return;

  const confirmed = window.confirm(
    `Radera användaren ${username || userId}? Detta tar bort favoriter, bokningar, sedda spelningar och hela kontot permanent.`,
  );
  if (!confirmed) return;

  adminUserDeleteId.value = userId;
  sourceStatus.value = "";

  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Kunde inte radera användaren.");
    }
    sourceStatus.value =
      payload.message || "Användaren och alla poster är borttagna.";
    await loadAdminUsers();
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte radera användaren.";
  } finally {
    adminUserDeleteId.value = "";
  }
}

async function loadAdminVisitors() {
  const response = await fetch("/api/admin/visitors");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "Kunde inte läsa besökare.");
  adminVisitors.value = payload.visitors || [];
}

async function loadAdminMailStatus() {
  const response = await fetch("/api/admin/mail-status");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "Kunde inte läsa mail-status.");
  adminMailStatus.value = {
    configured: Boolean(payload.configured),
    mode: payload.mode || "logs_only",
  };
}

async function loadAdminCounters() {
  try {
    await Promise.all([
      loadAdminUsers(),
      loadAdminVisitors(),
      loadAdminMailStatus(),
    ]);
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte läsa adminstatistik.";
  }
}

async function setAdminSubView(view) {
  adminSubView.value = view;

  if (!isAuthenticated.value) return;

  try {
    if (view === "sources") {
      await loadAdminCounters();
    }
    if (view === "users") {
      await loadAdminUsers();
    }
    if (view === "visitors") {
      await loadAdminVisitors();
    }
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte läsa adminstatistik.";
  }
}

function formatIcsDate(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function downloadCalendarEvent(concert) {
  const start = getConcertDate(concert);
  if (!start) return;

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const randomId =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const uid = `${getConcertId(concert) || randomId}@konsertnavigator`;
  const title = concert?.title || concert?.artist || "Spelning";
  const location = `${concert?.venue || "Okänd scen"}, ${concert?.city || "Okänd stad"}`;
  const description = getConcertDetailsUrl(concert)
    ? `Mer info: ${getConcertDetailsUrl(concert)}`
    : `Källa: ${getConcertSourceName(concert)}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soundcheck//SE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const fileName = `${normalizeText(title).replace(/\s+/g, "-") || "spelning"}.ics`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function checkAuth() {
  const response = await fetch("/api/auth/me");
  const payload = await response.json().catch(() => ({ authenticated: false }));

  isAuthenticated.value = Boolean(payload.authenticated);

  try {
    const sourcePayload = await loadSourcesDetailed();
    sources.value = sourcePayload.sources;
    sourceImportStatus.value = sourcePayload.sourceStatus;
  } catch {
    sources.value = [];
    sourceImportStatus.value = [];
  }
}

async function checkUserAuth() {
  try {
    const payload = await getUserSession();
    appUser.value = payload.authenticated ? payload.user : null;

    if (payload.authenticated) {
      applyUserLists(await loadUserLists());
      const follows = await loadUserFollows();
      followedArtists.value = follows.followedArtists || [];
      followedVenues.value = follows.followedVenues || [];
      applyUserPreferences(await loadUserPreferences());
    } else {
      applyUserLists({
        favorites: [],
        bookings: [],
        seen: [],
        followedArtists: [],
        followedVenues: [],
      });
      applyUserPreferences({
        newsletterEnabled: true,
        reminderEmailsEnabled: true,
      });
    }
  } catch {
    appUser.value = null;
    applyUserLists({
      favorites: [],
      bookings: [],
      seen: [],
      followedArtists: [],
      followedVenues: [],
    });
    applyUserPreferences({
      newsletterEnabled: true,
      reminderEmailsEnabled: true,
    });
  } finally {
    userAuthReady.value = true;
  }
}

async function login() {
  authLoading.value = true;
  authError.value = "";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: loginUsername.value,
        password: loginPassword.value,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      authError.value = payload.error || "Inloggning misslyckades.";
      return;
    }

    loginPassword.value = "";
    await checkAuth();
    closeAuthModal();
    setView("admin");
  } finally {
    authLoading.value = false;
  }
}

async function loginRegularUser() {
  userLoading.value = true;
  userError.value = "";
  userStatus.value = "";

  try {
    const payload = await loginUser({
      username: userLoginUsername.value,
      password: userLoginPassword.value,
    });

    appUser.value = payload.user;
    userLoginPassword.value = "";
    applyUserLists(await loadUserLists());
    const follows = await loadUserFollows();
    followedArtists.value = follows.followedArtists || [];
    followedVenues.value = follows.followedVenues || [];
    applyUserPreferences(await loadUserPreferences());
    userStatus.value = `Inloggad som ${payload.user.username}.`;
  } catch (error) {
    userError.value = error.message || "Kunde inte logga in.";
  } finally {
    userLoading.value = false;
  }
}

async function registerRegularUser() {
  userLoading.value = true;
  userError.value = "";
  userStatus.value = "";

  try {
    const payload = await registerUser({
      username: userRegisterUsername.value,
      email: userRegisterEmail.value,
      password: userRegisterPassword.value,
    });

    appUser.value = payload.user;
    userRegisterEmail.value = "";
    userRegisterPassword.value = "";
    applyUserLists(await loadUserLists());
    const follows = await loadUserFollows();
    followedArtists.value = follows.followedArtists || [];
    followedVenues.value = follows.followedVenues || [];
    applyUserPreferences(await loadUserPreferences());
    userStatus.value = `Konto skapat och inloggat som ${payload.user.username}.`;
  } catch (error) {
    userError.value = error.message || "Kunde inte skapa konto.";
  } finally {
    userLoading.value = false;
  }
}

async function forgotRegularUserPassword() {
  userLoading.value = true;
  userError.value = "";
  userStatus.value = "";

  try {
    const payload = await requestPasswordReset(forgotEmail.value);
    userStatus.value =
      payload.message || "Om e-post finns skickas en återställningslänk.";
  } catch (error) {
    userError.value = error.message || "Kunde inte skicka återställningslänk.";
  } finally {
    userLoading.value = false;
  }
}

async function resetRegularUserPassword() {
  userLoading.value = true;
  userError.value = "";
  userStatus.value = "";

  try {
    await resetPassword(resetToken.value, resetNewPassword.value);
    resetToken.value = "";
    resetNewPassword.value = "";
    userStatus.value = "Lösenordet är återställt. Du kan logga in nu.";
  } catch (error) {
    userError.value = error.message || "Kunde inte återställa lösenord.";
  } finally {
    userLoading.value = false;
  }
}

async function logoutRegularUser() {
  await logoutUser();
  appUser.value = null;
  applyUserLists({
    favorites: [],
    bookings: [],
    seen: [],
    followedArtists: [],
    followedVenues: [],
  });
  applyUserPreferences({
    newsletterEnabled: true,
    reminderEmailsEnabled: true,
  });
  userStatus.value = "Du är utloggad från användarkontot.";
}

async function saveUserPreferences() {
  if (!userAuthenticated.value) return;
  preferencesSaving.value = true;
  userError.value = "";
  userStatus.value = "";
  try {
    const next = await updateUserPreferences(userPreferences.value);
    applyUserPreferences(next);
    userStatus.value = "Mailinställningar uppdaterade.";
  } catch (error) {
    userError.value = error.message || "Kunde inte spara mailinställningar.";
  } finally {
    preferencesSaving.value = false;
  }
}

async function saveUserPassword() {
  if (!userAuthenticated.value) return;

  userError.value = "";
  userStatus.value = "";

  if (
    !userPasswordCurrent.value ||
    !userPasswordNext.value ||
    !userPasswordConfirm.value
  ) {
    userError.value = "Fyll i alla lösenordsfält.";
    return;
  }

  if (userPasswordNext.value !== userPasswordConfirm.value) {
    userError.value = "Nytt lösenord och bekräftelse matchar inte.";
    return;
  }

  userPasswordSaving.value = true;
  try {
    await changeUserPassword(userPasswordCurrent.value, userPasswordNext.value);
    userPasswordCurrent.value = "";
    userPasswordNext.value = "";
    userPasswordConfirm.value = "";
    userStatus.value = "Lösenordet uppdaterades.";
  } catch (error) {
    userError.value = error.message || "Kunde inte byta lösenord.";
  } finally {
    userPasswordSaving.value = false;
  }
}

async function submitUnsubscribe() {
  const token = String(unsubscribeToken.value || "").trim();
  if (!token) {
    unsubscribeError.value = "Unsubscribe-token saknas.";
    return;
  }

  unsubscribeLoading.value = true;
  unsubscribeError.value = "";
  unsubscribeStatus.value = "";
  try {
    const payload = await unsubscribeByToken(token);
    unsubscribeStatus.value =
      payload?.preference === "newsletter"
        ? "Veckobrev är nu avstängt för kontot."
        : "Påminnelsemail är nu avstängt för kontot.";
  } catch (error) {
    unsubscribeError.value =
      error.message || "Kunde inte avprenumerera med länken.";
  } finally {
    unsubscribeLoading.value = false;
  }
}

async function submitContactForm() {
  contactSubmitting.value = true;
  contactError.value = "";
  contactStatus.value = "";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contactName.value,
        email: contactEmail.value,
        message: contactMessage.value,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || (locale.value === "en" ? "Could not send message." : "Kunde inte skicka meddelandet."));
    }

    contactName.value = "";
    contactEmail.value = "";
    contactMessage.value = "";
    contactStatus.value =
      payload.message ||
      (locale.value === "en"
        ? "Thanks! Your message has been sent."
        : "Tack! Ditt meddelande har skickats.");
  } catch (error) {
    contactError.value =
      error.message ||
      (locale.value === "en"
        ? "Could not send message."
        : "Kunde inte skicka meddelandet.");
  } finally {
    contactSubmitting.value = false;
  }
}

async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
  });

  isAuthenticated.value = false;
  sourceStatus.value = "";
  passwordStatus.value = "";
  await checkAuth();
}

async function refreshConcerts() {
  const result = await loadStoredConcerts();
  concerts.value = result.concerts;
  lastUpdatedAt.value = result.lastUpdatedAt;
}

async function refreshPopularConcerts() {
  popularLoading.value = true;
  try {
    const response = await fetch("/api/concerts/popular");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Kunde inte läsa populära spelningar.");
    }
    popularItems.value = Array.isArray(payload.items) ? payload.items : [];
  } catch {
    popularItems.value = [];
  } finally {
    popularLoading.value = false;
  }
}

async function updateConcerts() {
  loading.value = true;
  status.value = "";
  fetchErrors.value = [];

  try {
    const result = await updateConcertsFromSources();
    concerts.value = result.concerts;
    fetchErrors.value = result.errors;
    lastUpdatedAt.value = result.lastUpdatedAt || lastUpdatedAt.value;
    sourceImportStatus.value = result.sourceStatus || sourceImportStatus.value;

    if (result.addedCount > 0) {
      status.value = `Lade till ${result.addedCount} nya konserter.`;
      await refreshPopularConcerts();
      return;
    }

    status.value = "Inga nya konserter hittades. Befintliga är kvar.";
    await refreshPopularConcerts();
  } catch (error) {
    status.value = error.message || "Kunde inte uppdatera konserter.";
  } finally {
    loading.value = false;
  }
}

async function clearConcerts() {
  if (!isAuthenticated.value) {
    status.value = "Du måste vara inloggad för att tömma listan.";
    return;
  }

  const shouldClear = window.confirm(
    "Är du säker på att du vill tömma alla lagrade konserter? Detta kan inte ångras.",
  );

  if (!shouldClear) {
    return;
  }

  loading.value = true;
  status.value = "";
  fetchErrors.value = [];

  try {
    const result = await clearStoredConcerts();
    concerts.value = result.concerts;
    status.value = `Rensade ${result.clearedCount} konserter från listan.`;
  } catch (error) {
    status.value = error.message || "Kunde inte tömma konserter.";
  } finally {
    loading.value = false;
  }
}

async function clearVisitors() {
  if (!isAuthenticated.value) {
    sourceStatus.value = "Du måste vara inloggad för att rensa besökare.";
    return;
  }

  const shouldClear = window.confirm(
    "Är du säker på att du vill rensa alla registrerade besökare? Detta kan inte ångras.",
  );

  if (!shouldClear) {
    return;
  }

  loading.value = true;
  sourceStatus.value = "";

  try {
    const response = await fetch("/api/admin/visitors", { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "Kunde inte rensa besökare.");
    adminVisitors.value = [];
    sourceStatus.value = "Alla besökare har rensats.";
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte rensa besökare.";
  } finally {
    loading.value = false;
  }
}

async function openSpotifyModal(artist) {
  spotifyArtist.value = artist;
  spotifyData.value = null;
  spotifyError.value = "";
  showSpotifyModal.value = true;

  spotifyLoading.value = true;
  try {
    const response = await fetch(
      `/api/spotify/search?artist=${encodeURIComponent(artist)}`,
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "Kunde inte hämta Spotify-data");
    spotifyData.value = payload;
  } catch (error) {
    spotifyError.value = error.message || "Kunde inte hämta låtar";
  } finally {
    spotifyLoading.value = false;
  }
}

function closeSpotifyModal() {
  showSpotifyModal.value = false;
}

async function submitSource() {
  if (!isAuthenticated.value) {
    sourceStatus.value = "Du måste vara inloggad för att ändra källor.";
    return;
  }

  sourceStatus.value = "";

  try {
    sources.value = await addSource({
      name: newSourceName.value,
      url: newSourceUrl.value,
    });

    newSourceName.value = "";
    newSourceUrl.value = "";
    sourceStatus.value = "Källa tillagd.";
    await checkAuth();
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte lägga till källa.";
  }
}

async function deleteSource(id) {
  if (!isAuthenticated.value) {
    sourceStatus.value = "Du måste vara inloggad för att ändra källor.";
    return;
  }

  try {
    sources.value = await removeSource(id);
    sourceStatus.value = "Källa borttagen.";
    await checkAuth();
  } catch (error) {
    sourceStatus.value = error.message || "Kunde inte ta bort källa.";
  }
}

async function submitPasswordChange() {
  passwordStatus.value = "";

  if (!passwordCurrent.value || !passwordNext.value || !passwordConfirm.value) {
    passwordStatus.value = "Fyll i alla lösenordsfält.";
    return;
  }

  if (passwordNext.value !== passwordConfirm.value) {
    passwordStatus.value = "Nytt lösenord och bekräftelse matchar inte.";
    return;
  }

  passwordLoading.value = true;

  try {
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: passwordCurrent.value,
        newPassword: passwordNext.value,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      passwordStatus.value = payload.error || "Kunde inte byta lösenord.";
      return;
    }

    passwordCurrent.value = "";
    passwordNext.value = "";
    passwordConfirm.value = "";
    passwordStatus.value = "Lösenord uppdaterat.";
  } finally {
    passwordLoading.value = false;
  }
}

onMounted(async () => {
  window.addEventListener("popstate", handleBrowserPopState);
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("pointerdown", handleGlobalPointerDown);
  const url = new URL(window.location.href);
  const tokenFromUrl = url.searchParams.get("resetToken");
  const unsubscribeTokenFromUrl = url.searchParams.get("token");
  const sharedConcertFromUrl = url.searchParams.get("concert");
  if (tokenFromUrl) {
    resetToken.value = tokenFromUrl;
    showResetForm.value = true;
    setView("my-concerts", { replaceUrl: true });
  }
  if (unsubscribeTokenFromUrl && getViewFromCurrentUrl() === "unsubscribe") {
    unsubscribeToken.value = unsubscribeTokenFromUrl;
    await submitUnsubscribe();
  }
  if (sharedConcertFromUrl) {
    sharedConcertId.value = sharedConcertFromUrl;
    setView("concerts", { replaceUrl: true });
  }
  updateSeo();

  try {
    await trackVisitor();
    await Promise.all([
      checkAuth(),
      checkUserAuth(),
      refreshConcerts(),
      refreshPopularConcerts(),
    ]);
  } finally {
    authReady.value = true;
  }
  await nextTick();
  if (currentView.value === "concerts") {
    initConcertsDateToPicker();
  }
});

watch(currentView, async (view) => {
  updateSeo();
  if (view === "concerts") {
    await nextTick();
    initConcertsDateToPicker();
    return;
  }

  destroyConcertsDateToPicker();
});

watch(concertsForCurrentView, () => {
  concertsDateToPicker?.redraw();
});

watch(
  locale,
  async (value) => {
    document.documentElement.lang = value === "en" ? "en" : "sv";
    if (typeof window !== "undefined") {
      window.localStorage.setItem("soundcheck_locale", value);
    }
    if (currentView.value === "concerts") {
      destroyConcertsDateToPicker();
      await nextTick();
      initConcertsDateToPicker();
    }
    updateSeo();
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("popstate", handleBrowserPopState);
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("pointerdown", handleGlobalPointerDown);
  destroyConcertsDateToPicker();
});

watch(
  favoriteArtistSuggestionConcerts,
  () => {
    syncFavoriteArtistNotifications();
  },
  { immediate: true },
);
</script>

<template>
  <main class="page">
    <div
      v-if="showSpotifyModal"
      class="modal-backdrop"
      @click.self="closeSpotifyModal"
    >
      <section class="modal-card">
        <div class="auth-header">
          <h2>♫ Spotify - {{ spotifyArtist }}</h2>
          <button class="link-button neutral" @click="closeSpotifyModal">
            Stäng
          </button>
        </div>

        <template v-if="spotifyLoading">
          <p class="lead">Hämtar låtar...</p>
        </template>

        <template v-else-if="spotifyError">
          <p class="lead error">{{ spotifyError }}</p>
          <p class="muted">
            Tips: Se till att Spotify-nycklar är konfigurerade på servern.
          </p>
        </template>

        <template v-else-if="spotifyData">
          <div class="spotify-header">
            <img
              v-if="spotifyData.artistImage"
              :src="spotifyData.artistImage"
              :alt="spotifyData.artist"
              class="artist-image"
            />
            <div>
              <h3>{{ spotifyData.artist }}</h3>
              <a
                v-if="spotifyData.spotifyUrl"
                :href="spotifyData.spotifyUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-button"
              >
                Öppna på Spotify
              </a>
            </div>
          </div>

          <h4 style="margin-top: 16px">Top 3 låtar</h4>
          <div class="spotify-tracks">
            <div
              v-for="(track, idx) in spotifyData.tracks"
              :key="idx"
              class="spotify-track"
            >
              <div class="track-info">
                <span class="track-number">{{ idx + 1 }}.</span>
                <div>
                  <p class="track-name">{{ track.name }}</p>
                  <p v-if="track.popularity" class="track-meta">
                    Popularitet: {{ track.popularity }}%
                  </p>
                </div>
              </div>
              <div class="track-actions">
                <a
                  v-if="track.preview"
                  :href="track.preview"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mini-action-button"
                >
                  ▷ Preview
                </a>
                <a
                  v-if="track.url"
                  :href="track.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mini-action-button"
                >
                  Spotify
                </a>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <p class="lead">Ingen data</p>
        </template>
      </section>
    </div>

    <header class="site-header">
      <button class="brand-block" type="button" @click="navigateTo('home')">
        <p class="brand">Soundcheck</p>
      </button>
      <nav
        class="header-quick-nav"
        :aria-label="locale === 'en' ? 'Quick navigation' : 'Snabbnavigering'"
      >
        <button
          class="nav-link"
          :class="{ active: currentView === 'concerts' }"
          type="button"
          @click="navigateTo('concerts')"
        >
          {{ t("nav.concerts") }}
        </button>
        <button
          class="nav-link"
          :class="{ active: currentView === 'my-concerts' }"
          type="button"
          @click="navigateTo('my-concerts')"
        >
          {{ t("nav.myConcerts") }}
        </button>
      </nav>
      <div class="locale-switch" role="group" aria-label="Språk">
        <button
          class="locale-option"
          :class="{ active: locale === 'sv' }"
          type="button"
          aria-label="Byt till svenska"
          @click="setLocale('sv')"
        >
          SV
        </button>
        <button
          class="locale-option"
          :class="{ active: locale === 'en' }"
          type="button"
          aria-label="Switch to English"
          @click="setLocale('en')"
        >
          EN
        </button>
      </div>
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="isMenuOpen"
        aria-controls="main-slide-menu"
        :aria-label="locale === 'en' ? 'Open menu' : 'Öppna meny'"
        @click="toggleMenu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </header>

    <div
      v-if="isMenuOpen"
      class="menu-overlay"
      role="presentation"
      @click="closeMenu"
    ></div>
    <aside
      id="main-slide-menu"
      class="slide-menu"
      :class="{ open: isMenuOpen }"
      :aria-label="locale === 'en' ? 'Main menu' : 'Huvudmeny'"
    >
      <nav class="slide-menu-nav">
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'home' }"
          type="button"
          @click="navigateTo('home')"
        >
          {{ t("nav.home") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'concerts' }"
          type="button"
          @click="navigateTo('concerts')"
        >
          {{ t("nav.concerts") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'my-concerts' }"
          type="button"
          @click="navigateTo('my-concerts')"
        >
          {{ t("nav.myConcerts") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'help' }"
          type="button"
          @click="navigateTo('help')"
        >
          {{ t("nav.help") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'contact' }"
          type="button"
          @click="navigateTo('contact')"
        >
          {{ t("nav.contact") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'sources' }"
          type="button"
          @click="navigateTo('sources')"
        >
          {{ t("nav.sources") }}
        </button>
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'settings' }"
          type="button"
          @click="navigateTo('settings')"
        >
          {{ t("nav.settings") }}
        </button>
        <button
          class="slide-menu-link"
          type="button"
          @click="handleMenuAuth"
        >
          {{ userAuthenticated ? t("nav.logout") : t("nav.login") }}
        </button>
      </nav>
      <div class="slide-menu-bottom">
        <button
          class="slide-menu-link"
          :class="{ active: currentView === 'admin' }"
          type="button"
          @click="handleMenuAdmin"
        >
          {{ t("nav.admin") }}
        </button>
      </div>
      <div class="slide-menu-footer">
        <p>{{ t("labels.version") }}: {{ displayVersion }}</p>
        <p>{{ t("labels.lastUpdated") }}: {{ formattedLastUpdatedAt }}</p>
      </div>
    </aside>

    <section v-if="status" class="hero">
      <p class="updated">{{ status }}</p>
    </section>
    <section v-if="shareStatus" class="hero">
      <p class="updated">{{ shareStatus }}</p>
    </section>

    <section v-if="!authReady" class="hero">
      <p class="lead">{{ t("labels.loadingAuth") }}</p>
    </section>

    <template v-else>
      <section v-if="currentView === 'home'" class="hero hero-transparent">
        <h1 class="home-title">{{ t("home.title") }}</h1>
        <p class="lead home-lead">
          {{ t("home.lead") }}
        </p>
      </section>

      <section v-if="currentView === 'home'" class="hero">
        <div class="section-head-row">
          <h2>{{ t("home.monthHeading", { month: currentMonthLabel }) }}</h2>
          <div class="view-mode-toggle">
            <button
              class="view-mode-option"
              :class="{ active: homeListView === 'cards' }"
              type="button"
              @click="homeListView = 'cards'"
            >
              {{ locale === "en" ? "Card view" : "Kortvy" }}
            </button>
            <button
              class="view-mode-option"
              :class="{ active: homeListView === 'table' }"
              type="button"
              @click="homeListView = 'table'"
            >
              {{ locale === "en" ? "List view" : "Listvy" }}
            </button>
          </div>
        </div>

        <section
          v-if="currentMonthConcerts.length && homeListView === 'cards'"
          class="concert-cards-grid"
        >
          <article
            v-for="concert in currentMonthConcerts"
            :key="`home-card-${getConcertId(concert)}`"
            class="concert-tile"
          >
            <div class="concert-tile-media">
              <img
                class="concert-tile-image"
                :src="getConcertDisplayImageUrl(concert)"
                :alt="`Bild för ${concert.title}`"
                loading="lazy"
              />
              <p class="concert-tile-tag">{{ getConcertGenreLabel(concert) }}</p>
              <button
                class="heart-button tile-heart"
                :class="{ active: isFavorite(concert) }"
                :aria-label="isFavorite(concert) ? 'Ta bort favorit' : 'Spara favorit'"
                @click="toggleFavorite(concert)"
              >
                {{ isFavorite(concert) ? "★" : "☆" }}
              </button>
            </div>

            <div class="concert-tile-body">
              <h3>{{ concert.artist }}</h3>
              <p class="venue-line">
                <span class="venue-city"
                  >{{ concert.venue }}{{ concert.city ? ` · ${concert.city}` : "" }}</span
                >
                <span class="concert-date">{{ formatDate(concert.date) }}</span>
              </p>
              <a
                v-if="getConcertReadMoreUrl(concert)"
                class="readmore card-readmore"
                :href="getConcertReadMoreUrl(concert)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t("actions.readMore") }}
              </a>
              <div class="card-footer">
                <div class="mini-actions card-footer-main">
                  <button
                    class="mini-action-button"
                    :class="{ active: isBooked(concert) }"
                    type="button"
                    @click="toggleBooking(concert)"
                  >
                    {{ t("actions.going") }}
                  </button>
                  <button
                    class="mini-action-button"
                    type="button"
                    @click="downloadCalendarEvent(concert)"
                  >
                    {{ t("actions.addCalendar") }}
                  </button>
                  <button
                    class="mini-action-button"
                    type="button"
                    @click="shareConcert(concert)"
                  >
                    {{ t("actions.shareConcert") }}
                  </button>
                  <button
                    class="mini-action-button"
                    type="button"
                    @click="openSpotifyModal(concert.artist)"
                  >
                    {{ t("actions.play") }}
                  </button>
                </div>
                <details class="card-menu">
                  <summary class="card-menu-toggle" aria-label="Fler åtgärder">
                    ☰
                  </summary>
                  <div class="card-menu-list">
                    <button
                      class="mini-action-button"
                      :class="{ active: isSeen(concert) }"
                      type="button"
                      @click="toggleSeen(concert)"
                    >
                      {{ t("actions.seen") }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedArtist(concert.artist) }"
                      type="button"
                      @click="toggleFollowArtist(concert.artist)"
                    >
                      {{
                        isFollowedArtist(concert.artist)
                          ? t("actions.followingArtist")
                          : t("actions.followArtist")
                      }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedVenue(concert.venue) }"
                      type="button"
                      @click="toggleFollowVenue(concert.venue)"
                    >
                      {{
                        isFollowedVenue(concert.venue)
                          ? t("actions.followingVenue")
                          : t("actions.followVenue")
                      }}
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </article>
        </section>

        <section
          v-if="currentMonthConcerts.length && homeListView === 'table'"
          class="hero concerts-table-wrap"
        >
          <table class="concerts-table">
            <thead>
              <tr>
                <th class="col-date">Datum</th>
                <th class="col-artist">Artist</th>
                <th class="col-venue">Plats</th>
                <th class="col-city">Ort</th>
                <th class="col-actions">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="concert in currentMonthConcerts"
                :key="`home-row-${getConcertId(concert)}`"
              >
                <td class="cell-date">{{ formatDate(concert.date) }}</td>
                <td class="cell-artist">{{ concert.artist }}</td>
                <td class="cell-venue">{{ concert.venue }}</td>
                <td class="cell-city">{{ concert.city }}</td>
                <td class="cell-actions">
                  <div class="table-actions">
                    <button
                      class="mini-action-button"
                      :class="{ active: isFavorite(concert) }"
                      type="button"
                      @click="toggleFavorite(concert)"
                    >
                      {{ isFavorite(concert) ? "Favorit" : "Spara" }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isBooked(concert) }"
                      type="button"
                      @click="toggleBooking(concert)"
                    >
                      {{ t("actions.going") }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="downloadCalendarEvent(concert)"
                    >
                      {{ t("actions.addCalendar") }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="shareConcert(concert)"
                    >
                      {{ t("actions.shareConcert") }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedArtist(concert.artist) }"
                      type="button"
                      @click="toggleFollowArtist(concert.artist)"
                    >
                      {{
                        isFollowedArtist(concert.artist)
                          ? t("actions.followingArtist")
                          : t("actions.followArtist")
                      }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedVenue(concert.venue) }"
                      type="button"
                      @click="toggleFollowVenue(concert.venue)"
                    >
                      {{
                        isFollowedVenue(concert.venue)
                          ? t("actions.followingVenue")
                          : t("actions.followVenue")
                      }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="openSpotifyModal(concert.artist)"
                    >
                      {{ t("actions.play") }}
                    </button>
                  </div>
                  <details class="table-row-menu">
                    <summary class="table-row-menu-toggle" aria-label="Fler åtgärder">
                      ☰
                    </summary>
                    <div class="table-row-menu-list">
                      <button
                        class="mini-action-button"
                        :class="{ active: isFavorite(concert) }"
                        type="button"
                        @click="toggleFavorite(concert)"
                      >
                        {{ isFavorite(concert) ? "Favorit" : "Spara" }}
                      </button>
                      <button
                        class="mini-action-button"
                        :class="{ active: isBooked(concert) }"
                        type="button"
                        @click="toggleBooking(concert)"
                      >
                        {{ t("actions.going") }}
                      </button>
                      <button
                        class="mini-action-button"
                        type="button"
                        @click="downloadCalendarEvent(concert)"
                      >
                        {{ t("actions.addCalendar") }}
                      </button>
                      <button
                        class="mini-action-button"
                        type="button"
                        @click="shareConcert(concert)"
                      >
                        {{ t("actions.shareConcert") }}
                      </button>
                      <button
                        class="mini-action-button"
                        :class="{ active: isFollowedArtist(concert.artist) }"
                        type="button"
                        @click="toggleFollowArtist(concert.artist)"
                      >
                        {{
                          isFollowedArtist(concert.artist)
                            ? t("actions.followingArtist")
                            : t("actions.followArtist")
                        }}
                      </button>
                      <button
                        class="mini-action-button"
                        :class="{ active: isFollowedVenue(concert.venue) }"
                        type="button"
                        @click="toggleFollowVenue(concert.venue)"
                      >
                        {{
                          isFollowedVenue(concert.venue)
                            ? t("actions.followingVenue")
                            : t("actions.followVenue")
                        }}
                      </button>
                      <button
                        class="mini-action-button"
                        type="button"
                        @click="openSpotifyModal(concert.artist)"
                      >
                        {{ t("actions.play") }}
                      </button>
                      <p class="table-row-menu-info table-row-menu-info-city">
                        {{ locale === "en" ? "City" : "Ort" }}: {{ concert.city }}
                      </p>
                      <p class="table-row-menu-info table-row-menu-info-venue">
                        {{ locale === "en" ? "Venue" : "Plats" }}: {{ concert.venue }}
                      </p>
                    </div>
                  </details>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <p v-if="!currentMonthConcerts.length" class="lead">
          {{ t("home.noMonthConcerts") }}
        </p>
      </section>

      <section v-if="currentView === 'help'" class="hero source-panel">
        <h2>Hjälp</h2>
        <p class="lead">Här ser du vad du kan göra i Soundcheck.</p>
        <ul class="source-list source-status-list">
          <li>
            <div>
              <strong>Hem</strong>
              <p>Snabb överblick över spelningar för aktuell månad.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Källor</strong>
              <p>Publik lista med aktiva källnamn. Stöd finns även för WordPress-baserade eventkällor som Dalhalla.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Spelningar</strong>
              <p>
                Visa kommande/tidigare spelningar, använd snabbfilter (Denna
                vecka, I helgen), filtrera på källa/månad/genre, sök på
                artist/scen/stad, välj ett specifikt datum i kalendern (med
                markerade eventdagar), växla mellan kortvy och tabellvy (med
                snabbtnappar i båda vyerna),
                se populära spelningar denna vecka, dela en spelning med
                direktlänk, och klicka ♫ för Spotify artist-info.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>♫ Spotify</strong>
              <p>
                Klicka på ♫-knappen på en spelning för att se artistens top 5
                låtar på Spotify med preview-länkar och popularitet.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Mina Spelningar</strong>
              <p>
                Skapa konto, logga in, få välkomstmail, spara favoriter,
                markera Ska gå/Var där och lägg till i kalender. Du får även
                mailnotiser om sparade/bokade spelningar och nya matchningar på
                artister/scener du följer, samt ett veckoutskick med spelningar
                från flera städer. Som inloggad kan du stänga av veckobrev och
                påminnelser, och alla notismail har länk till avprenumerering.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Kontakt</strong>
              <p>
                Skicka feedback, felrapporter eller förslag direkt via
                kontaktformuläret i menyn.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Admin</strong>
              <p>
                Hantera källor, kör uppdatering, töm konserter, se
                importkvalitet, följ användare/besökare och radera användare.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Lösenordsåterställning</strong>
              <p>
                Använd “Glömt lösenord” för återställning. En länk skickas till
                din e-postadress och gäller i 30 minuter.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="currentView === 'contact'" class="hero source-panel contact-panel">
        <h2>{{ t("contact.title") }}</h2>
        <p class="lead">{{ t("contact.lead") }}</p>
        <form class="source-form contact-form" @submit.prevent="submitContactForm">
          <input
            v-model="contactName"
            type="text"
            :placeholder="t('contact.name')"
            required
          />
          <input
            v-model="contactEmail"
            type="email"
            :placeholder="t('contact.email')"
            required
          />
          <textarea
            v-model="contactMessage"
            class="contact-message"
            :placeholder="t('contact.message')"
            rows="5"
            required
          ></textarea>
          <button class="refresh" type="submit" :disabled="contactSubmitting">
            {{ contactSubmitting ? t("contact.submitting") : t("contact.submit") }}
          </button>
        </form>
        <p v-if="contactStatus" class="updated">{{ contactStatus }}</p>
        <p v-if="contactError" class="error">{{ contactError }}</p>
      </section>

      <section v-if="currentView === 'sources'" class="hero source-panel">
        <h2>Källor</h2>
        <ul v-if="sources.length" class="source-list source-name-list">
          <li v-for="source in sources" :key="source.id">
            <strong>{{ source.name }}</strong>
          </li>
        </ul>
        <p v-else class="lead">Inga källor tillagda än.</p>
      </section>

      <section v-if="currentView === 'admin'" class="hero source-panel">
        <h2>Admin</h2>

        <template v-if="isAuthenticated">
          <p v-if="!adminMailStatus.configured" class="updated">
            Mail är inte konfigurerat. Sätt RESEND_API_KEY och
            RESET_EMAIL_FROM i miljövariabler för att aktivera utskick.
          </p>
          <p v-else class="updated">Mailutskick är aktivt.</p>

          <div class="main-nav concerts-submenu">
            <button
              class="nav-link"
              :class="{ active: adminSubView === 'sources' }"
              type="button"
              @click="setAdminSubView('sources')"
            >
              Källor
            </button>
            <button
              class="nav-link"
              :class="{ active: adminSubView === 'users' }"
              type="button"
              @click="setAdminSubView('users')"
            >
              Unika användare
            </button>
            <button
              class="nav-link"
              :class="{ active: adminSubView === 'visitors' }"
              type="button"
              @click="setAdminSubView('visitors')"
            >
              Unika besökare
            </button>
          </div>

          <div class="actions">
            <button
              class="refresh"
              type="button"
              @click="updateConcerts"
              :disabled="loading"
            >
              {{ loading ? "Uppdaterar..." : "Uppdatera konserter" }}
            </button>
            <button
              class="refresh danger"
              type="button"
              @click="clearConcerts"
              :disabled="loading"
            >
              Töm konserter
            </button>
            <button class="refresh" type="button" @click="logout">
              Logga ut
            </button>
          </div>

          <p class="lead admin-counter">
            Unika användare: <strong>{{ adminUsers.length }}</strong> | Unika
            besökare: <strong>{{ adminVisitors.length }}</strong>
          </p>

          <template v-if="adminSubView === 'sources'">
            <p class="lead">
              Här hanterar du källor, importkvalitet och admininställningar.
            </p>

            <form class="source-form" @submit.prevent="submitSource">
              <input
                v-model="newSourceName"
                type="text"
                placeholder="Namn, t.ex. Ticketmaster"
              />
              <input
                v-model="newSourceUrl"
                type="url"
                placeholder="URL till eventsida, t.ex. https://www.furuvik.se/konserter"
              />
              <button class="refresh" type="submit">Lägg till källa</button>
            </form>

            <p v-if="sourceStatus" class="updated">{{ sourceStatus }}</p>

            <ul v-if="sources.length" class="source-list">
              <li v-for="source in sources" :key="source.id">
                <div>
                  <strong>{{ source.name }}</strong>
                  <a
                    :href="source.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ source.url }}</a
                  >
                </div>
                <button class="link-button" @click="deleteSource(source.id)">
                  Ta bort
                </button>
              </li>
            </ul>
            <p v-else class="lead">Inga källor tillagda än.</p>

            <h2>Importkvalitet</h2>
            <ul
              v-if="sourceImportStatus.length"
              class="source-list source-status-list"
            >
              <li v-for="item in sourceImportStatus" :key="item.sourceId">
                <div>
                  <strong>{{ item.sourceName }}</strong>
                  <p>Antal hämtade: {{ item.fetchedCount }}</p>
                  <p>Fel: {{ item.error || "Inget" }}</p>
                  <p>Senaste körning: {{ formatStatusDate(item.lastRunAt) }}</p>
                </div>
              </li>
            </ul>
            <p v-else class="lead">
              Ingen körning ännu. Klicka Uppdatera för att fylla status.
            </p>

            <h2>Byt lösenord</h2>
            <form class="login-form" @submit.prevent="submitPasswordChange">
              <div class="password-field">
                <input
                  v-model="passwordCurrent"
                  :type="showPasswordCurrent ? 'text' : 'password'"
                  placeholder="Nuvarande lösenord"
                />
                <button
                  class="toggle-password"
                  type="button"
                  @click="showPasswordCurrent = !showPasswordCurrent"
                >
                  {{ showPasswordCurrent ? "Dölj" : "Visa" }}
                </button>
              </div>
              <div class="password-field">
                <input
                  v-model="passwordNext"
                  :type="showPasswordNext ? 'text' : 'password'"
                  placeholder="Nytt lösenord"
                />
                <button
                  class="toggle-password"
                  type="button"
                  @click="showPasswordNext = !showPasswordNext"
                >
                  {{ showPasswordNext ? "Dölj" : "Visa" }}
                </button>
              </div>
              <div class="password-field">
                <input
                  v-model="passwordConfirm"
                  :type="showPasswordConfirm ? 'text' : 'password'"
                  placeholder="Bekräfta nytt lösenord"
                />
                <button
                  class="toggle-password"
                  type="button"
                  @click="showPasswordConfirm = !showPasswordConfirm"
                >
                  {{ showPasswordConfirm ? "Dölj" : "Visa" }}
                </button>
              </div>
              <button class="refresh" type="submit" :disabled="passwordLoading">
                {{ passwordLoading ? "Sparar..." : "Byt lösenord" }}
              </button>
            </form>
            <p v-if="passwordStatus" class="updated">{{ passwordStatus }}</p>
          </template>

          <template v-else-if="adminSubView === 'users'">
            <h2>Unika användare</h2>
            <ul v-if="adminUsers.length" class="source-list source-status-list">
              <li v-for="user in adminUsers" :key="user.id">
                <div>
                  <strong>{{ user.username }}</strong>
                  <p v-if="user.email">{{ user.email }}</p>
                  <p>
                    Favoriter: {{ user.favoritesCount }} | Bokningar:
                    {{ user.bookingsCount }} | Sedda: {{ user.seenCount }}
                  </p>
                </div>
                <button
                  class="link-button danger"
                  type="button"
                  :disabled="adminUserDeleteId === user.id"
                  @click="deleteAdminUser(user)"
                >
                  {{
                    adminUserDeleteId === user.id
                      ? "Raderar..."
                      : "Radera användare"
                  }}
                </button>
              </li>
            </ul>
            <p v-else class="lead">Inga användare registrerade ännu.</p>
          </template>

          <template v-else-if="adminSubView === 'visitors'">
            <h2>Unika besökare</h2>
            <ul
              v-if="adminVisitors.length"
              class="source-list source-status-list"
            >
              <li v-for="visitor in adminVisitors" :key="visitor.id">
                <div>
                  <strong>{{ visitor.id }}</strong>
                  <p>Först sedd: {{ formatStatusDate(visitor.firstSeenAt) }}</p>
                  <p>Senast sedd: {{ formatStatusDate(visitor.lastSeenAt) }}</p>
                </div>
              </li>
            </ul>
            <p v-else class="lead">Inga besökare registrerade ännu.</p>

            <div class="actions">
              <button
                class="refresh danger"
                type="button"
                @click="clearVisitors"
                :disabled="loading"
              >
                {{ loading ? "Rensar..." : "Rensa alla besökare" }}
              </button>
            </div>
          </template>
        </template>

        <template v-else>
          <p class="lead">Du behöver logga in som admin för att se denna vy.</p>
          <button class="refresh" @click="openAuthModal">Logga in</button>
        </template>
      </section>

      <section v-if="currentView === 'my-concerts'" class="hero source-panel">
        <h2>Mina Spelningar</h2>

        <template v-if="!userAuthReady">
          <p class="lead">Laddar användarstatus...</p>
        </template>

        <template v-else-if="!userAuthenticated">
          <p class="lead">
            Registrera dig eller logga in för att hantera dina personliga
            spelningslistor.
          </p>
          <p class="updated">
            Lösenordsåterställning skickas via e-post när du använder "Glömt
            lösenord".
          </p>

          <div class="user-auth-grid">
            <form
              class="user-auth-form stacked-form"
              @submit.prevent="registerRegularUser"
            >
              <h3>Skapa konto</h3>
              <label class="field-group">
                <span>Användarnamn</span>
                <input
                  v-model="userRegisterUsername"
                  type="text"
                  placeholder="t.ex. tobias"
                  autocomplete="username"
                />
              </label>
              <label class="field-group">
                <span>E-post</span>
                <input
                  v-model="userRegisterEmail"
                  type="email"
                  placeholder="namn@epost.se"
                  autocomplete="email"
                />
              </label>
              <label class="field-group">
                <span>Lösenord</span>
                <div class="password-field">
                  <input
                    v-model="userRegisterPassword"
                    :type="showUserRegisterPassword ? 'text' : 'password'"
                    placeholder="Minst 8 tecken"
                    autocomplete="new-password"
                  />
                  <button
                    class="toggle-password"
                    type="button"
                    @click="
                      showUserRegisterPassword = !showUserRegisterPassword
                    "
                  >
                    {{ showUserRegisterPassword ? "Dölj" : "Visa" }}
                  </button>
                </div>
              </label>
              <button class="refresh" type="submit" :disabled="userLoading">
                Registrera
              </button>
            </form>

            <form
              class="user-auth-form stacked-form"
              @submit.prevent="loginRegularUser"
            >
              <h3>Logga in</h3>
              <label class="field-group">
                <span>Användarnamn eller e-post</span>
                <input
                  v-model="userLoginUsername"
                  type="text"
                  placeholder="användarnamn eller namn@epost.se"
                  autocomplete="username"
                />
              </label>
              <label class="field-group">
                <span>Lösenord</span>
                <div class="password-field">
                  <input
                    v-model="userLoginPassword"
                    :type="showUserLoginPassword ? 'text' : 'password'"
                    placeholder="Ditt lösenord"
                    autocomplete="current-password"
                  />
                  <button
                    class="toggle-password"
                    type="button"
                    @click="showUserLoginPassword = !showUserLoginPassword"
                  >
                    {{ showUserLoginPassword ? "Dölj" : "Visa" }}
                  </button>
                </div>
              </label>
              <button class="refresh" type="submit" :disabled="userLoading">
                Logga in
              </button>
            </form>

            <form
              class="user-auth-form stacked-form"
              @submit.prevent="forgotRegularUserPassword"
            >
              <h3>Glömt lösenord</h3>
              <label class="field-group">
                <span>E-post</span>
                <input
                  v-model="forgotEmail"
                  type="email"
                  placeholder="Din registrerade e-post"
                  autocomplete="email"
                />
              </label>
              <button class="refresh" type="submit" :disabled="userLoading">
                Skicka länk
              </button>
            </form>
          </div>

          <button
            class="link-button neutral"
            type="button"
            @click="showResetForm = !showResetForm"
          >
            {{
              showResetForm
                ? "Dölj återställning"
                : "Har du fått en länk? Återställ lösenord"
            }}
          </button>

          <form
            v-if="showResetForm"
            class="user-auth-form stacked-form"
            @submit.prevent="resetRegularUserPassword"
          >
            <h3>Återställ lösenord</h3>
            <label class="field-group">
              <span>Reset-token</span>
              <input
                v-model="resetToken"
                type="text"
                placeholder="Token från mail-länken"
              />
            </label>
            <label class="field-group">
              <span>Nytt lösenord</span>
              <div class="password-field">
                <input
                  v-model="resetNewPassword"
                  :type="showResetNewPassword ? 'text' : 'password'"
                  placeholder="Minst 8 tecken"
                  autocomplete="new-password"
                />
                <button
                  class="toggle-password"
                  type="button"
                  @click="showResetNewPassword = !showResetNewPassword"
                >
                  {{ showResetNewPassword ? "Dölj" : "Visa" }}
                </button>
              </div>
            </label>
            <button class="refresh" type="submit" :disabled="userLoading">
              Spara lösenord
            </button>
          </form>

          <p v-if="userError" class="updated">{{ userError }}</p>
          <p v-if="userStatus" class="updated">{{ userStatus }}</p>
        </template>

        <template v-else>
          <div class="auth-header">
            <p class="lead">
              Inloggad som <strong>{{ appUser.username }}</strong>
            </p>
            <button class="link-button" @click="logoutRegularUser">
              Logga ut användare
            </button>
          </div>

          <div class="main-nav concerts-submenu">
            <button
              class="nav-link"
              :class="{ active: myConcertsSubView === 'favorites' }"
              type="button"
              @click="myConcertsSubView = 'favorites'"
            >
              Mina favoriter
            </button>
            <button
              class="nav-link"
              :class="{ active: myConcertsSubView === 'bookings' }"
              type="button"
              @click="myConcertsSubView = 'bookings'"
                >
                  {{ t("actions.going") }}
                </button>
            <button
              class="nav-link"
              :class="{ active: myConcertsSubView === 'seen' }"
              type="button"
              @click="myConcertsSubView = 'seen'"
                >
                  {{ t("actions.seen") }}
                </button>
          </div>

          <div
            v-if="myConcertsSubView === 'favorites'"
            class="favorites-toolbar"
          >
            <label class="search-label" for="favorite-sort"
              >Sortera favoriter</label
            >
            <select
              id="favorite-sort"
              v-model="favoritesSort"
              class="search-input"
            >
              <option value="date_asc">Datum (äldst först)</option>
              <option value="date_desc">Datum (nyast först)</option>
              <option value="artist_asc">Artist (A-Ö)</option>
              <option value="city_asc">Stad (A-Ö)</option>
            </select>
          </div>

          <section
            v-if="
              myConcertsSubView === 'favorites' &&
              newFavoriteArtistSuggestionConcerts.length
            "
            class="hero"
          >
            <h3>New concerts from your favorite artists</h3>
            <p class="lead">
              {{ newFavoriteArtistSuggestionConcerts.length }} new match(es)
              found.
            </p>
            <ul class="source-list source-name-list">
              <li
                v-for="concert in newFavoriteArtistSuggestionConcerts.slice(
                  0,
                  5,
                )"
                :key="`fav-artist-alert-${getConcertId(concert)}`"
              >
                <strong>{{ concert.artist }}</strong>
              </li>
            </ul>
            <button
              class="refresh"
              type="button"
              @click="markFavoriteArtistNotificationsSeen"
            >
              Mark as seen
            </button>
          </section>

          <p v-if="userStatus" class="updated">{{ userStatus }}</p>

          <section
            v-if="followedArtists.length || followedVenues.length"
            class="hero"
          >
            <h3>Nytt från det du följer</h3>
            <p class="lead">
              {{
                followedReleaseConcerts.length
                  ? "Nya kommande spelningar från artister/scener du följer."
                  : "Inga nya kommande spelningar från det du följer just nu."
              }}
            </p>
            <ul v-if="followedReleaseConcerts.length" class="source-list source-status-list">
              <li
                v-for="concert in followedReleaseConcerts.slice(0, 8)"
                :key="`followed-release-${getConcertId(concert)}`"
              >
                <div>
                  <strong>{{ concert.artist }}</strong>
                  <p>{{ formatDate(concert.date) }} · {{ concert.venue }}</p>
                </div>
              </li>
            </ul>
          </section>

          <div v-if="myConcertsBySubView.length" class="list compact-list">
            <article
              v-for="concert in myConcertsBySubView"
              :key="`fav-${concert.artist}-${concert.date}-${concert.venue}`"
              class="card"
            >
              <div class="meta">
                <img
                  class="concert-image"
                  :src="getConcertDisplayImageUrl(concert)"
                  :alt="`Bild för ${concert.title}`"
                  loading="lazy"
                />
              </div>

              <div class="content">
                <h3>{{ concert.artist }}</h3>
                <p class="venue-line">
                  <span class="venue-city"
                    >{{ concert.venue }}{{ concert.city ? ` · ${concert.city}` : "" }}</span
                  >
                  <span class="concert-date">{{ formatDate(concert.date) }}</span>
                </p>
                <p class="genre">{{ getConcertGenreLabel(concert) }}</p>
                <p class="source">{{ getConcertSourceName(concert) }}</p>
                <a
                  v-if="getConcertReadMoreUrl(concert)"
                  class="readmore card-readmore"
                  :href="getConcertReadMoreUrl(concert)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t("actions.readMore") }}
                </a>
                <div class="card-footer">
                  <div class="mini-actions card-footer-main">
                    <button
                      class="mini-action-button"
                      :class="{ active: isBooked(concert) }"
                      type="button"
                      @click="toggleBooking(concert)"
                    >
                      {{ t("actions.going") }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="downloadCalendarEvent(concert)"
                    >
                      {{ t("actions.addCalendar") }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="shareConcert(concert)"
                    >
                      {{ t("actions.shareConcert") }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="openSpotifyModal(concert.artist)"
                    >
                      {{ t("actions.play") }}
                    </button>
                  </div>
                  <details class="card-menu">
                    <summary class="card-menu-toggle" aria-label="Fler åtgärder">
                      ☰
                    </summary>
                    <div class="card-menu-list">
                      <button
                        class="mini-action-button"
                        :class="{ active: isSeen(concert) }"
                        type="button"
                        @click="toggleSeen(concert)"
                      >
                        {{ t("actions.seen") }}
                      </button>
                      <button
                        class="mini-action-button"
                        :class="{ active: isFollowedArtist(concert.artist) }"
                        type="button"
                        @click="toggleFollowArtist(concert.artist)"
                      >
                        {{
                          isFollowedArtist(concert.artist)
                            ? t("actions.followingArtist")
                            : t("actions.followArtist")
                        }}
                      </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedVenue(concert.venue) }"
                        type="button"
                        @click="toggleFollowVenue(concert.venue)"
                      >
                        {{
                          isFollowedVenue(concert.venue)
                            ? t("actions.followingVenue")
                            : t("actions.followVenue")
                        }}
                      </button>
                    </div>
                  </details>
                </div>
                <button
                  class="heart-button"
                  :class="{ active: isFavorite(concert) }"
                  aria-label="Ta bort favorit"
                  @click="toggleFavorite(concert)"
                >
                  {{ isFavorite(concert) ? "★" : "☆" }}
                </button>
              </div>
            </article>
          </div>

          <p v-else class="lead">Inga spelningar i vald kategori ännu.</p>
        </template>
      </section>

      <section v-if="currentView === 'settings'" class="hero source-panel">
        <h2>Inställningar</h2>

        <template v-if="!userAuthenticated">
          <p class="lead">
            Du behöver vara inloggad för att hantera inställningar.
          </p>
          <button class="refresh" type="button" @click="setView('my-concerts')">
            Gå till inloggning
          </button>
        </template>

        <template v-else>
          <p class="lead">
            Hantera e-postnotiser och byt lösenord för ditt användarkonto.
          </p>

          <section class="hero preference-box">
            <h3>E-postinställningar</h3>
            <p class="lead">
              Välj om du vill få veckobrev och påminnelser. Välkomstmail och
              lösenordsåterställning skickas alltid.
            </p>
            <label class="checkbox-row">
              <input
                v-model="userPreferences.newsletterEnabled"
                type="checkbox"
              />
              <span>Veckobrev</span>
            </label>
            <label class="checkbox-row">
              <input
                v-model="userPreferences.reminderEmailsEnabled"
                type="checkbox"
              />
              <span>Påminnelser om bokningar/favoriter</span>
            </label>
            <button
              class="refresh"
              type="button"
              :disabled="preferencesSaving"
              @click="saveUserPreferences"
            >
              {{ preferencesSaving ? "Sparar..." : "Spara mailinställningar" }}
            </button>
          </section>

          <section class="hero preference-box">
            <h3>Byt lösenord</h3>
            <div class="password-field">
              <input
                v-model="userPasswordCurrent"
                :type="showUserPasswordCurrent ? 'text' : 'password'"
                placeholder="Nuvarande lösenord"
                autocomplete="current-password"
              />
              <button
                class="toggle-password"
                type="button"
                @click="showUserPasswordCurrent = !showUserPasswordCurrent"
              >
                {{ showUserPasswordCurrent ? "Dölj" : "Visa" }}
              </button>
            </div>
            <div class="password-field">
              <input
                v-model="userPasswordNext"
                :type="showUserPasswordNext ? 'text' : 'password'"
                placeholder="Nytt lösenord"
                autocomplete="new-password"
              />
              <button
                class="toggle-password"
                type="button"
                @click="showUserPasswordNext = !showUserPasswordNext"
              >
                {{ showUserPasswordNext ? "Dölj" : "Visa" }}
              </button>
            </div>
            <div class="password-field">
              <input
                v-model="userPasswordConfirm"
                :type="showUserPasswordConfirm ? 'text' : 'password'"
                placeholder="Bekräfta nytt lösenord"
                autocomplete="new-password"
              />
              <button
                class="toggle-password"
                type="button"
                @click="showUserPasswordConfirm = !showUserPasswordConfirm"
              >
                {{ showUserPasswordConfirm ? "Dölj" : "Visa" }}
              </button>
            </div>
            <button
              class="refresh"
              type="button"
              :disabled="userPasswordSaving"
              @click="saveUserPassword"
            >
              {{ userPasswordSaving ? "Sparar..." : "Byt lösenord" }}
            </button>
          </section>

          <p v-if="userError" class="updated">{{ userError }}</p>
          <p v-if="userStatus" class="updated">{{ userStatus }}</p>
        </template>
      </section>

      <section v-if="currentView === 'unsubscribe'" class="hero source-panel">
        <h2>Avprenumerera mail</h2>
        <p class="lead">
          Den här sidan används av länkar i veckobrev och påminnelsemail.
        </p>
        <label class="field-group">
          <span>Unsubscribe-token</span>
          <input
            v-model="unsubscribeToken"
            type="text"
            placeholder="Token från e-postlänken"
          />
        </label>
        <button
          class="refresh"
          type="button"
          :disabled="unsubscribeLoading"
          @click="submitUnsubscribe"
        >
          {{ unsubscribeLoading ? "Avprenumererar..." : "Avprenumerera" }}
        </button>
        <p v-if="unsubscribeStatus" class="updated">{{ unsubscribeStatus }}</p>
        <p v-if="unsubscribeError" class="updated">{{ unsubscribeError }}</p>
      </section>

      <section v-if="currentView === 'concerts'" class="hero discovery-panel">
        <div class="discovery-top">
          <div class="discovery-controls">
            <div class="concerts-subview-toggle" role="group" :aria-label="locale === 'en' ? 'Concert timeframe' : 'Tidsfilter för spelningar'">
              <button
                class="concerts-subview-option"
                :class="{ active: concertsSubView === 'upcoming' }"
                type="button"
                @click="setConcertsSubView('upcoming')"
              >
                {{ locale === "en" ? "Upcoming" : "Framtida" }}
              </button>
              <button
                class="concerts-subview-option"
                :class="{ active: concertsSubView === 'past' }"
                type="button"
                @click="setConcertsSubView('past')"
              >
                {{ locale === "en" ? "Past" : "Tidigare" }}
              </button>
            </div>

            <div v-if="!sharedConcertId" class="quick-filters-toggle" role="group" :aria-label="locale === 'en' ? 'Quick filters' : 'Snabbfilter'">
              <button
                v-for="option in quickDiscoverOptions"
                :key="option.id"
                class="quick-filter-option"
                :class="{ active: quickDiscoverMode === option.id }"
                type="button"
                @click="quickDiscoverMode = option.id"
              >
                {{ option.label }} ({{ quickFilterCounts[option.id] || 0 }})
              </button>
            </div>

            <div class="view-mode-toggle">
              <button
                class="view-mode-option"
                :class="{ active: concertsListView === 'cards' }"
                type="button"
                @click="setConcertsListView('cards')"
              >
                {{ locale === "en" ? "Card view" : "Kortvy" }}
              </button>
              <button
                class="view-mode-option"
                :class="{ active: concertsListView === 'table' }"
                type="button"
                @click="setConcertsListView('table')"
              >
                {{ locale === "en" ? "List view" : "Listvy" }}
              </button>
            </div>
            <button
              class="view-mode-option filter-modal-trigger"
              type="button"
              @click="openFiltersModal"
            >
              {{ locale === "en" ? "Filters" : "Visa filter" }}
            </button>
          </div>
        </div>

        <div class="search-panel">
          <div class="search-table">
            <p class="search-label">
              {{ locale === "en" ? "Search concert" : "Sök spelning" }}
            </p>
            <p class="search-label">
              {{ locale === "en" ? "Choose date" : "Välj datum" }}
            </p>
            <input
              id="concert-search"
              v-model="concertsSearch"
              class="search-input"
              type="search"
              :placeholder="
                locale === 'en'
                  ? 'Search by artist, venue or city...'
                  : 'Sök på artist, scen eller stad...'
              "
            />
            <div class="search-date-actions">
              <input
                id="concert-date-to"
                ref="concertsDateToInput"
                class="search-input search-input-date"
                type="text"
                :placeholder="locale === 'en' ? 'Choose date' : 'Välj datum'"
                readonly
              />
              <button
                class="nav-link search-clear-date"
                type="button"
                :disabled="!concertsDateTo"
                @click="clearConcertsDateTo"
              >
                {{ locale === "en" ? "Clear date" : "Rensa datum" }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="currentView === 'concerts' && filtersModalOpen"
        class="modal-backdrop"
        @click.self="closeFiltersModal"
      >
        <div class="modal-card filter-modal-card">
          <div class="auth-header">
            <h2>
              {{
                concertsSubView === "past"
                  ? (locale === "en" ? "Filter past concerts" : "Filtrera tidigare spelningar")
                  : (locale === "en" ? "Filter upcoming concerts" : "Filtrera kommande spelningar")
              }}
            </h2>
            <button class="link-button neutral" type="button" @click="closeFiltersModal">
              {{ locale === "en" ? "Close" : "Stäng" }}
            </button>
          </div>
          <div class="filter-body">
            <p class="filter-title">{{ locale === "en" ? "Sources" : "Källor" }}</p>
            <div class="filter-actions">
              <button class="link-button neutral" @click="selectAllSources">
                {{ locale === "en" ? "Select all sources" : "Välj alla källor" }}
              </button>
              <button class="link-button neutral" @click="deselectAllSources">
                {{ locale === "en" ? "Select no sources" : "Välj inga källor" }}
              </button>
            </div>
            <div class="filter-options">
              <label
                v-for="sourceName in availableSourceNames"
                :key="sourceName"
                class="filter-option"
                :class="{ active: isSourceSelected(sourceName) }"
              >
                <input
                  type="checkbox"
                  :checked="isSourceSelected(sourceName)"
                  @change="toggleSourceFilter(sourceName)"
                />
                <span>{{ sourceName }}</span>
              </label>
            </div>

            <p v-if="availableMonthNumbers.length" class="filter-title">
              {{ locale === "en" ? "Months" : "Månader" }}
            </p>
            <div v-if="availableMonthNumbers.length" class="filter-actions">
              <button class="link-button neutral" @click="selectAllMonths">
                {{ locale === "en" ? "Select all months" : "Välj alla månader" }}
              </button>
              <button class="link-button neutral" @click="deselectAllMonths">
                {{ locale === "en" ? "Select no months" : "Välj inga månader" }}
              </button>
            </div>
            <div v-if="availableMonthNumbers.length" class="filter-options">
              <label
                v-for="monthNumber in availableMonthNumbers"
                :key="monthNumber"
                class="filter-option"
                :class="{ active: isMonthSelected(monthNumber) }"
              >
                <input
                  type="checkbox"
                  :checked="isMonthSelected(monthNumber)"
                  @change="toggleMonthFilter(monthNumber)"
                />
                <span>{{ getMonthLabel(monthNumber) }}</span>
              </label>
            </div>

            <p v-if="availableGenreLabels.length" class="filter-title">
              {{ locale === "en" ? "Genres" : "Genrer" }}
            </p>
            <div v-if="availableGenreLabels.length" class="filter-actions">
              <button class="link-button neutral" @click="selectAllGenres">
                {{ locale === "en" ? "Select all genres" : "Välj alla genrer" }}
              </button>
              <button class="link-button neutral" @click="deselectAllGenres">
                {{ locale === "en" ? "Select no genres" : "Välj inga genrer" }}
              </button>
            </div>
            <div v-if="availableGenreLabels.length" class="filter-options">
              <label
                v-for="genreLabel in availableGenreLabels"
                :key="genreLabel"
                class="filter-option"
                :class="{ active: isGenreSelected(genreLabel) }"
              >
                <input
                  type="checkbox"
                  :checked="isGenreSelected(genreLabel)"
                  @change="toggleGenreFilter(genreLabel)"
                />
                <span>{{ genreLabel }}</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="
          currentView === 'concerts' &&
          concertsSubView === 'upcoming' &&
          !sharedConcertId &&
          (popularThisWeekConcerts.length || popularLoading)
        "
        class="hero popular-panel"
      >
        <h2>{{ locale === "en" ? "Popular concerts this week" : "Populära spelningar denna vecka" }}</h2>
        <p class="lead">
          Baserat på antal likes och bokningar från användare i Soundcheck.
        </p>
        <ul v-if="popularThisWeekConcerts.length" class="source-list popular-list">
          <li
            v-for="item in popularThisWeekConcerts"
            :key="`popular-${getConcertId(item.concert)}`"
          >
            <div>
              <strong>{{ item.concert.artist }}</strong>
              <p>{{ formatDate(item.concert.date) }} · {{ item.concert.venue }}</p>
            </div>
            <strong class="popular-score"
              >{{ item.stats.score }} poäng ({{ item.stats.likes }} likes / {{ item.stats.bookings }} bokningar)</strong
            >
          </li>
        </ul>
        <p v-else class="lead">{{ locale === "en" ? "Loading popular concerts..." : "Laddar populära spelningar..." }}</p>
      </section>

      <section
        v-if="currentView === 'concerts' && sharedConcert"
        class="hero shared-concert-cta"
      >
        <h2>Delad spelning</h2>
        <p class="lead">{{ locale === "en" ? "This is the shared concert:" : "Det här är spelningen som delas:" }}</p>
        <p class="shared-concert-summary">
          <strong>{{ sharedConcert.artist }}</strong>
          <span>{{ formatDate(sharedConcert.date) }}</span>
          <span
            >{{ sharedConcert.venue
            }}{{ sharedConcert.city ? `, ${sharedConcert.city}` : "" }}</span
          >
        </p>
        <p class="lead">Du ser endast den delade spelningen just nu.</p>
        <div class="actions">
          <button class="refresh" type="button" @click="handleSharedConcertCta">
            {{
              isFavorite(sharedConcert)
                ? `Ta bort ${sharedConcert.artist} från favoriter`
                : `Spara ${sharedConcert.artist} i favoriter`
            }}
          </button>
          <button
            class="nav-link"
            type="button"
            @click="clearSharedConcertMode"
          >
            {{ locale === "en" ? "Show all concerts" : "Visa alla spelningar" }}
          </button>
          <button
            class="nav-link"
            type="button"
            @click="setView('my-concerts')"
          >
            {{ t("actions.openMyConcerts") }}
          </button>
        </div>
      </section>

      <section
        v-if="
          currentView === 'concerts' &&
          concertsListView === 'cards' &&
          sortedFilteredConcerts.length
        "
        class="concert-cards-grid"
      >
        <article
          v-for="concert in sortedFilteredConcerts"
          :key="`concert-card-${getConcertId(concert)}`"
          class="concert-tile"
          :class="{ highlighted: getConcertId(concert) === sharedConcertId }"
        >
          <div class="concert-tile-media">
            <img
              class="concert-tile-image"
              :src="getConcertDisplayImageUrl(concert)"
              :alt="`Bild för ${concert.title}`"
              loading="lazy"
            />
            <p class="concert-tile-tag">{{ getConcertGenreLabel(concert) }}</p>
            <button
              class="heart-button tile-heart"
              :class="{ active: isFavorite(concert) }"
              :aria-label="isFavorite(concert) ? 'Ta bort favorit' : 'Spara favorit'"
              @click="toggleFavorite(concert)"
            >
              {{ isFavorite(concert) ? "★" : "☆" }}
            </button>
          </div>

          <div class="concert-tile-body">
            <h3>{{ concert.artist }}</h3>
            <p class="venue-line">
              <span class="venue-city"
                >{{ concert.venue }}{{ concert.city ? ` · ${concert.city}` : "" }}</span
              >
              <span class="concert-date">{{ formatDate(concert.date) }}</span>
            </p>
            <a
              v-if="getConcertReadMoreUrl(concert)"
              class="readmore card-readmore"
              :href="getConcertReadMoreUrl(concert)"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t("actions.readMore") }}
            </a>
            <div class="card-footer">
              <div class="mini-actions card-footer-main">
                <button
                  class="mini-action-button"
                  :class="{ active: isBooked(concert) }"
                  type="button"
                  @click="toggleBooking(concert)"
                >
                  {{ t("actions.going") }}
                </button>
                <button
                  class="mini-action-button"
                  type="button"
                  @click="downloadCalendarEvent(concert)"
                >
                  {{ t("actions.addCalendar") }}
                </button>
                <button
                  class="mini-action-button"
                  type="button"
                  @click="shareConcert(concert)"
                >
                  {{ t("actions.shareConcert") }}
                </button>
                <button
                  class="mini-action-button"
                  type="button"
                  @click="openSpotifyModal(concert.artist)"
                >
                  {{ t("actions.play") }}
                </button>
              </div>
              <details class="card-menu">
                <summary class="card-menu-toggle" aria-label="Fler åtgärder">
                  ☰
                </summary>
                <div class="card-menu-list">
                  <button
                    class="mini-action-button"
                    :class="{ active: isSeen(concert) }"
                    type="button"
                    @click="toggleSeen(concert)"
                  >
                    {{ t("actions.seen") }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isFollowedArtist(concert.artist) }"
                    type="button"
                    @click="toggleFollowArtist(concert.artist)"
                  >
                    {{
                      isFollowedArtist(concert.artist)
                        ? t("actions.followingArtist")
                        : t("actions.followArtist")
                    }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isFollowedVenue(concert.venue) }"
                    type="button"
                    @click="toggleFollowVenue(concert.venue)"
                  >
                    {{
                      isFollowedVenue(concert.venue)
                        ? t("actions.followingVenue")
                        : t("actions.followVenue")
                      }}
                    </button>
                </div>
              </details>
            </div>
          </div>
        </article>
      </section>

      <section
        v-if="
          currentView === 'concerts' &&
          concertsListView === 'table' &&
          sortedFilteredConcerts.length
        "
        class="hero concerts-table-wrap"
      >
        <table class="concerts-table">
            <thead>
              <tr>
              <th class="col-date">Datum</th>
              <th class="col-artist">Artist</th>
              <th class="col-venue">Plats</th>
              <th class="col-city">Ort</th>
              <th class="col-actions">Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="concert in sortedFilteredConcerts"
              :key="`concert-row-${getConcertId(concert)}`"
            >
              <td class="cell-date">{{ formatDate(concert.date) }}</td>
              <td class="cell-artist">{{ concert.artist }}</td>
              <td class="cell-venue">{{ concert.venue }}</td>
              <td class="cell-city">{{ concert.city }}</td>
              <td class="cell-actions">
                <div class="table-actions">
                  <button
                    class="mini-action-button"
                    :class="{ active: isFavorite(concert) }"
                    type="button"
                    @click="toggleFavorite(concert)"
                  >
                    {{ isFavorite(concert) ? "Favorit" : "Spara" }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isBooked(concert) }"
                    type="button"
                    @click="toggleBooking(concert)"
                  >
                    {{ t("actions.going") }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isSeen(concert) }"
                    type="button"
                    @click="toggleSeen(concert)"
                  >
                    {{ t("actions.seen") }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isFollowedArtist(concert.artist) }"
                    type="button"
                    @click="toggleFollowArtist(concert.artist)"
                  >
                    {{ isFollowedArtist(concert.artist) ? "Följer artist" : "Följ artist" }}
                  </button>
                  <button
                    class="mini-action-button"
                    :class="{ active: isFollowedVenue(concert.venue) }"
                    type="button"
                    @click="toggleFollowVenue(concert.venue)"
                  >
                    {{ isFollowedVenue(concert.venue) ? "Följer scen" : "Följ scen" }}
                  </button>
                  <button
                    class="mini-action-button"
                    type="button"
                    @click="shareConcert(concert)"
                  >
                    Dela
                  </button>
                </div>
                <details class="table-row-menu">
                  <summary class="table-row-menu-toggle" aria-label="Fler åtgärder">
                    ☰
                  </summary>
                  <div class="table-row-menu-list">
                    <button
                      class="mini-action-button"
                      :class="{ active: isFavorite(concert) }"
                      type="button"
                      @click="toggleFavorite(concert)"
                    >
                      {{ isFavorite(concert) ? "Favorit" : "Spara" }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isBooked(concert) }"
                      type="button"
                      @click="toggleBooking(concert)"
                    >
                      {{ t("actions.going") }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isSeen(concert) }"
                      type="button"
                      @click="toggleSeen(concert)"
                    >
                      {{ t("actions.seen") }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedArtist(concert.artist) }"
                      type="button"
                      @click="toggleFollowArtist(concert.artist)"
                    >
                      {{ isFollowedArtist(concert.artist) ? "Följer artist" : "Följ artist" }}
                    </button>
                    <button
                      class="mini-action-button"
                      :class="{ active: isFollowedVenue(concert.venue) }"
                      type="button"
                      @click="toggleFollowVenue(concert.venue)"
                    >
                      {{ isFollowedVenue(concert.venue) ? "Följer scen" : "Följ scen" }}
                    </button>
                    <button
                      class="mini-action-button"
                      type="button"
                      @click="shareConcert(concert)"
                    >
                      Dela
                    </button>
                    <p class="table-row-menu-info table-row-menu-info-city">
                      {{ locale === "en" ? "City" : "Ort" }}: {{ concert.city }}
                    </p>
                    <p class="table-row-menu-info table-row-menu-info-venue">
                      {{ locale === "en" ? "Venue" : "Plats" }}: {{ concert.venue }}
                    </p>
                  </div>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="currentView === 'concerts' && !sortedFilteredConcerts.length"
        class="hero"
      >
        <p class="lead">
          {{
            concertsSubView === "past"
              ? "Inga passerade spelningar hittades."
              : "Inga kommande spelningar hittades."
          }}
        </p>
      </section>

      <section
        v-if="fetchErrors.length && currentView !== 'sources'"
        class="hero errors"
      >
        <h2>Kunde inte läsa vissa källor</h2>
        <ul>
          <li v-for="(error, index) in fetchErrors" :key="index">
            {{ error }}
          </li>
        </ul>
      </section>
    </template>

    <div
      v-if="showAuthModal && !isAuthenticated"
      class="modal-backdrop"
      @click.self="closeAuthModal"
    >
      <section class="modal-card">
        <div class="auth-header">
          <h2>Admin-inloggning</h2>
          <button class="link-button neutral" @click="closeAuthModal">
            Stäng
          </button>
        </div>
        <p class="lead">
          Endast inloggad admin kan lägga till och ta bort källor.
        </p>

        <form class="login-form modal-login" @submit.prevent="login">
          <input
            v-model="loginUsername"
            type="text"
            placeholder="Användarnamn"
          />
          <div class="password-field">
            <input
              v-model="loginPassword"
              :type="showAdminLoginPassword ? 'text' : 'password'"
              placeholder="Lösenord"
            />
            <button
              class="toggle-password"
              type="button"
              @click="showAdminLoginPassword = !showAdminLoginPassword"
            >
              {{ showAdminLoginPassword ? "Dölj" : "Visa" }}
            </button>
          </div>
          <button class="refresh" type="submit" :disabled="authLoading">
            {{ authLoading ? "Loggar in..." : "Logga in" }}
          </button>
        </form>

        <p v-if="authError" class="updated">{{ authError }}</p>
      </section>
    </div>
  </main>
</template>
