<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  clearStoredConcerts,
  loadStoredConcerts,
  updateConcertsFromSources
} from './services/concertStore'
import { addSource, loadSources, removeSource } from './services/sourceStore'
import {
  addFavorite,
  getUserSession,
  loadFavorites,
  loginUser,
  logoutUser,
  registerUser,
  removeFavorite
} from './services/userStore'

const concerts = ref([])
const sources = ref([])
const loading = ref(false)
const status = ref('')
const sourceStatus = ref('')
const fetchErrors = ref([])

const currentView = ref('home')
const showAuthModal = ref(false)

const isAuthenticated = ref(false)
const authReady = ref(false)
const authError = ref('')
const loginUsername = ref('')
const loginPassword = ref('')
const authLoading = ref(false)

const appUser = ref(null)
const userAuthReady = ref(false)
const userError = ref('')
const userStatus = ref('')
const userLoginUsername = ref('')
const userLoginPassword = ref('')
const userRegisterUsername = ref('')
const userRegisterPassword = ref('')
const userLoading = ref(false)
const favoriteIds = ref([])

const passwordCurrent = ref('')
const passwordNext = ref('')
const passwordConfirm = ref('')
const passwordLoading = ref(false)
const passwordStatus = ref('')

const newSourceName = ref('')
const newSourceUrl = ref('')
const deselectedSources = ref([])
const deselectedMonths = ref([])
const deselectedGenres = ref([])

const monthFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'long' })
const monthYearFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })

function getConcertDate(concert) {
  const date = new Date(concert?.date)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getConcertId(concert) {
  const date = getConcertDate(concert)
  if (!date) return ''

  return [
    normalizeText(concert.artist),
    normalizeText(concert.venue),
    normalizeText(concert.city),
    date.toISOString()
  ].join('|')
}

function getConcertSourceName(concert) {
  const sourceName = String(concert?.sourceName || '').trim()
  return sourceName || 'Okänd källa'
}

function getConcertGenre(concert) {
  return String(concert?.genre || '').trim()
}

function getConcertGenreLabel(concert) {
  const genre = getConcertGenre(concert)
  return genre || 'Övrigt'
}

function getConcertDetailsUrl(concert) {
  return String(concert?.detailsUrl || '').trim()
}

function getConcertImageUrl(concert) {
  return String(concert?.imageUrl || '').trim()
}

function getMonthLabel(monthNumber) {
  return monthFormatter.format(new Date(Date.UTC(2024, monthNumber, 1)))
}

function setView(view) {
  currentView.value = view
}

function openAuthModal() {
  authError.value = ''
  showAuthModal.value = true
}

function closeAuthModal() {
  showAuthModal.value = false
}

async function handleAuthButton() {
  if (isAuthenticated.value) {
    await logout()
    status.value = 'Du är utloggad.'
    setView('home')
    return
  }

  openAuthModal()
}

const userAuthenticated = computed(() => Boolean(appUser.value))

const availableSourceNames = computed(() => {
  return [...new Set(concerts.value.map((concert) => getConcertSourceName(concert)))].sort((a, b) =>
    a.localeCompare(b, 'sv-SE')
  )
})

function getConcertMonth(concert) {
  const date = getConcertDate(concert)
  return date ? date.getMonth() : null
}

const availableMonthNumbers = computed(() => {
  const months = concerts.value
    .map((concert) => getConcertMonth(concert))
    .filter((month) => month !== null)

  return [...new Set(months)].sort((a, b) => a - b)
})

const availableGenreLabels = computed(() => {
  const genres = [...new Set(concerts.value.map((concert) => getConcertGenreLabel(concert)))]

  return genres.sort((a, b) => {
    if (a === 'Övrigt' && b !== 'Övrigt') return 1
    if (b === 'Övrigt' && a !== 'Övrigt') return -1
    return a.localeCompare(b, 'sv-SE')
  })
})

const currentMonthLabel = computed(() => {
  return monthYearFormatter.format(new Date())
})

const currentMonthConcerts = computed(() => {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  return concerts.value
    .filter((concert) => {
      const date = getConcertDate(concert)
      return date && date.getMonth() === month && date.getFullYear() === year
    })
    .sort((a, b) => getConcertDate(a) - getConcertDate(b))
})

const filteredConcerts = computed(() => {
  return concerts.value.filter((concert) => {
    const sourceIncluded = !deselectedSources.value.includes(getConcertSourceName(concert))
    const month = getConcertMonth(concert)
    const monthIncluded = month === null || !deselectedMonths.value.includes(month)
    const genreIncluded = !deselectedGenres.value.includes(getConcertGenreLabel(concert))

    return sourceIncluded && monthIncluded && genreIncluded
  })
})

const groupedByYearAndMonth = computed(() => {
  const yearGroups = new Map()

  for (const concert of filteredConcerts.value) {
    const date = getConcertDate(concert)
    if (!date) continue

    const year = date.getFullYear()
    const month = date.getMonth()

    if (!yearGroups.has(year)) {
      yearGroups.set(year, new Map())
    }

    const monthGroups = yearGroups.get(year)

    if (!monthGroups.has(month)) {
      monthGroups.set(month, [])
    }

    monthGroups.get(month).push(concert)
  }

  return [...yearGroups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, monthGroups]) => ({
      year,
      months: [...monthGroups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([month, items]) => ({
          month,
          label: getMonthLabel(month),
          concerts: items
        }))
    }))
})

const favoriteConcerts = computed(() => {
  if (!favoriteIds.value.length) return []

  const favoriteSet = new Set(favoriteIds.value)
  return concerts.value
    .filter((concert) => favoriteSet.has(getConcertId(concert)))
    .sort((a, b) => getConcertDate(a) - getConcertDate(b))
})

function isFavorite(concert) {
  const id = getConcertId(concert)
  return Boolean(id) && favoriteIds.value.includes(id)
}

async function toggleFavorite(concert) {
  if (!userAuthenticated.value) {
    userStatus.value = 'Logga in eller registrera dig för att spara favoriter.'
    setView('favorites')
    return
  }

  const concertId = getConcertId(concert)
  if (!concertId) return

  try {
    if (isFavorite(concert)) {
      favoriteIds.value = await removeFavorite(concertId)
      userStatus.value = 'Tog bort spelning från favoriter.'
      return
    }

    favoriteIds.value = await addFavorite(concertId)
    userStatus.value = 'Spelning sparad i favoriter.'
  } catch (error) {
    userStatus.value = error.message || 'Kunde inte uppdatera favoriter.'
  }
}

function isSourceSelected(sourceName) {
  return !deselectedSources.value.includes(sourceName)
}

function toggleSourceFilter(sourceName) {
  if (isSourceSelected(sourceName)) {
    deselectedSources.value = [...deselectedSources.value, sourceName]
    return
  }

  deselectedSources.value = deselectedSources.value.filter((name) => name !== sourceName)
}

function selectAllSources() {
  deselectedSources.value = []
}

function deselectAllSources() {
  deselectedSources.value = [...availableSourceNames.value]
}

function isMonthSelected(monthNumber) {
  return !deselectedMonths.value.includes(monthNumber)
}

function toggleMonthFilter(monthNumber) {
  if (isMonthSelected(monthNumber)) {
    deselectedMonths.value = [...deselectedMonths.value, monthNumber]
    return
  }

  deselectedMonths.value = deselectedMonths.value.filter((value) => value !== monthNumber)
}

function selectAllMonths() {
  deselectedMonths.value = []
}

function deselectAllMonths() {
  deselectedMonths.value = [...availableMonthNumbers.value]
}

function isGenreSelected(genreLabel) {
  return !deselectedGenres.value.includes(genreLabel)
}

function toggleGenreFilter(genreLabel) {
  if (isGenreSelected(genreLabel)) {
    deselectedGenres.value = [...deselectedGenres.value, genreLabel]
    return
  }

  deselectedGenres.value = deselectedGenres.value.filter((value) => value !== genreLabel)
}

function selectAllGenres() {
  deselectedGenres.value = []
}

function deselectAllGenres() {
  deselectedGenres.value = [...availableGenreLabels.value]
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate))
}

async function checkAuth() {
  const response = await fetch('/api/auth/me')
  const payload = await response.json().catch(() => ({ authenticated: false }))

  isAuthenticated.value = Boolean(payload.authenticated)

  try {
    sources.value = await loadSources()
  } catch {
    sources.value = []
  }
}

async function checkUserAuth() {
  try {
    const payload = await getUserSession()
    appUser.value = payload.authenticated ? payload.user : null

    if (payload.authenticated) {
      favoriteIds.value = await loadFavorites()
    } else {
      favoriteIds.value = []
    }
  } catch {
    appUser.value = null
    favoriteIds.value = []
  } finally {
    userAuthReady.value = true
  }
}

async function login() {
  authLoading.value = true
  authError.value = ''

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: loginUsername.value,
        password: loginPassword.value
      })
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      authError.value = payload.error || 'Inloggning misslyckades.'
      return
    }

    loginPassword.value = ''
    await checkAuth()
    closeAuthModal()
    setView('sources')
  } finally {
    authLoading.value = false
  }
}

async function loginRegularUser() {
  userLoading.value = true
  userError.value = ''
  userStatus.value = ''

  try {
    const payload = await loginUser({
      username: userLoginUsername.value,
      password: userLoginPassword.value
    })

    appUser.value = payload.user
    userLoginPassword.value = ''
    favoriteIds.value = await loadFavorites()
    userStatus.value = `Inloggad som ${payload.user.username}.`
  } catch (error) {
    userError.value = error.message || 'Kunde inte logga in.'
  } finally {
    userLoading.value = false
  }
}

async function registerRegularUser() {
  userLoading.value = true
  userError.value = ''
  userStatus.value = ''

  try {
    const payload = await registerUser({
      username: userRegisterUsername.value,
      password: userRegisterPassword.value
    })

    appUser.value = payload.user
    userRegisterPassword.value = ''
    favoriteIds.value = await loadFavorites()
    userStatus.value = `Konto skapat och inloggat som ${payload.user.username}.`
  } catch (error) {
    userError.value = error.message || 'Kunde inte skapa konto.'
  } finally {
    userLoading.value = false
  }
}

async function logoutRegularUser() {
  await logoutUser()
  appUser.value = null
  favoriteIds.value = []
  userStatus.value = 'Du är utloggad från användarkontot.'
}

async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST'
  })

  isAuthenticated.value = false
  sourceStatus.value = ''
  passwordStatus.value = ''
  await checkAuth()
}

async function refreshConcerts() {
  concerts.value = await loadStoredConcerts()
}

async function updateConcerts() {
  loading.value = true
  status.value = ''
  fetchErrors.value = []

  try {
    const result = await updateConcertsFromSources()
    concerts.value = result.concerts
    fetchErrors.value = result.errors

    if (result.addedCount > 0) {
      status.value = `Lade till ${result.addedCount} nya konserter.`
      return
    }

    status.value = 'Inga nya konserter hittades. Befintliga är kvar.'
  } catch (error) {
    status.value = error.message || 'Kunde inte uppdatera konserter.'
  } finally {
    loading.value = false
  }
}

async function clearConcerts() {
  if (!isAuthenticated.value) {
    status.value = 'Du måste vara inloggad för att tömma listan.'
    return
  }

  const shouldClear = window.confirm(
    'Är du säker på att du vill tömma alla lagrade konserter? Detta kan inte ångras.'
  )

  if (!shouldClear) {
    return
  }

  loading.value = true
  status.value = ''
  fetchErrors.value = []

  try {
    const result = await clearStoredConcerts()
    concerts.value = result.concerts
    status.value = `Rensade ${result.clearedCount} konserter från listan.`
  } catch (error) {
    status.value = error.message || 'Kunde inte tömma konserter.'
  } finally {
    loading.value = false
  }
}

async function submitSource() {
  if (!isAuthenticated.value) {
    sourceStatus.value = 'Du måste vara inloggad för att ändra källor.'
    return
  }

  sourceStatus.value = ''

  try {
    sources.value = await addSource({
      name: newSourceName.value,
      url: newSourceUrl.value
    })

    newSourceName.value = ''
    newSourceUrl.value = ''
    sourceStatus.value = 'Källa tillagd.'
  } catch (error) {
    sourceStatus.value = error.message || 'Kunde inte lägga till källa.'
  }
}

async function deleteSource(id) {
  if (!isAuthenticated.value) {
    sourceStatus.value = 'Du måste vara inloggad för att ändra källor.'
    return
  }

  try {
    sources.value = await removeSource(id)
    sourceStatus.value = 'Källa borttagen.'
  } catch (error) {
    sourceStatus.value = error.message || 'Kunde inte ta bort källa.'
  }
}

async function submitPasswordChange() {
  passwordStatus.value = ''

  if (!passwordCurrent.value || !passwordNext.value || !passwordConfirm.value) {
    passwordStatus.value = 'Fyll i alla lösenordsfält.'
    return
  }

  if (passwordNext.value !== passwordConfirm.value) {
    passwordStatus.value = 'Nytt lösenord och bekräftelse matchar inte.'
    return
  }

  passwordLoading.value = true

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: passwordCurrent.value,
        newPassword: passwordNext.value
      })
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      passwordStatus.value = payload.error || 'Kunde inte byta lösenord.'
      return
    }

    passwordCurrent.value = ''
    passwordNext.value = ''
    passwordConfirm.value = ''
    passwordStatus.value = 'Lösenord uppdaterat.'
  } finally {
    passwordLoading.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([checkAuth(), checkUserAuth(), refreshConcerts()])
  } finally {
    authReady.value = true
  }
})
</script>

<template>
  <main class="page">
    <header class="site-header">
      <p class="brand">Konsertnavigator</p>
      <nav class="main-nav" aria-label="Huvudmeny">
        <button class="nav-link" :class="{ active: currentView === 'home' }" @click="setView('home')">
          Hem
        </button>
        <button
          class="nav-link"
          :class="{ active: currentView === 'sources' }"
          @click="setView('sources')"
        >
          Källor
        </button>
        <button
          class="nav-link"
          :class="{ active: currentView === 'concerts' }"
          @click="setView('concerts')"
        >
          Spelningar
        </button>
        <button
          class="nav-link"
          :class="{ active: currentView === 'favorites' }"
          @click="setView('favorites')"
        >
          Favoriter
        </button>
        <button class="nav-link nav-action" @click="updateConcerts" :disabled="loading">
          {{ loading ? 'Uppdaterar...' : 'Uppdatera' }}
        </button>
        <button
          v-if="isAuthenticated"
          class="nav-link nav-action nav-danger"
          @click="clearConcerts"
          :disabled="loading"
        >
          Töm
        </button>
        <button class="nav-link" @click="handleAuthButton">
          {{ isAuthenticated ? 'Logga ut admin' : 'Admin-inlogg' }}
        </button>
      </nav>
    </header>

    <section v-if="status" class="hero">
      <p class="updated">{{ status }}</p>
    </section>

    <section v-if="!authReady" class="hero">
      <p class="lead">Laddar inloggningsstatus...</p>
    </section>

    <template v-else>
      <section v-if="currentView === 'home'" class="hero">
        <p class="kicker">Konsertnavigator</p>
        <h1>Välkommen</h1>
        <p class="lead">
          Här samlar vi konserter från flera källor på ett ställe. Gå till Spelningar för hela
          listan och filtrering, till Källor för datakällor och till Favoriter för att spara dina
          personliga spelningar.
        </p>
      </section>

      <section v-if="currentView === 'home'" class="hero">
        <h2>Spelningar i {{ currentMonthLabel }}</h2>

        <div v-if="currentMonthConcerts.length" class="list compact-list">
          <article
            v-for="concert in currentMonthConcerts"
            :key="`home-${concert.artist}-${concert.date}-${concert.venue}`"
            class="card"
          >
            <div class="meta">
              <img
                v-if="getConcertImageUrl(concert)"
                class="concert-image"
                :src="getConcertImageUrl(concert)"
                :alt="`Bild för ${concert.title}`"
                loading="lazy"
              />
              <p>{{ formatDate(concert.date) }}</p>
              <p>{{ concert.city }}</p>
            </div>

            <div class="content">
              <h3>{{ concert.artist }}</h3>
              <p class="title">{{ concert.title }}</p>
              <p class="venue">{{ concert.venue }}</p>
              <p v-if="getConcertGenre(concert)" class="genre">{{ getConcertGenre(concert) }}</p>
              <p class="source">{{ getConcertSourceName(concert) }}</p>
              <button class="link-button favorite" @click="toggleFavorite(concert)">
                {{ isFavorite(concert) ? 'Ta bort favorit' : 'Spara favorit' }}
              </button>
              <a
                v-if="getConcertDetailsUrl(concert)"
                class="readmore"
                :href="getConcertDetailsUrl(concert)"
                target="_blank"
                rel="noopener noreferrer"
              >
                Läs mer
              </a>
            </div>
          </article>
        </div>

        <p v-else class="lead">Inga spelningar hittades för aktuell månad.</p>
      </section>

      <section v-if="currentView === 'sources'" class="hero source-panel">
        <h2>Källor</h2>

        <template v-if="isAuthenticated">
          <p class="lead">
            Du kan ange en vanlig webbsida eller en JSON-URL. Appen försöker extrahera event
            automatiskt.
          </p>

          <form class="source-form" @submit.prevent="submitSource">
            <input v-model="newSourceName" type="text" placeholder="Namn, t.ex. Ticketmaster" />
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
                <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.url }}</a>
              </div>
              <button class="link-button" @click="deleteSource(source.id)">Ta bort</button>
            </li>
          </ul>
          <p v-else class="lead">Inga källor tillagda än.</p>

          <h2>Byt lösenord</h2>
          <form class="login-form" @submit.prevent="submitPasswordChange">
            <input v-model="passwordCurrent" type="password" placeholder="Nuvarande lösenord" />
            <input v-model="passwordNext" type="password" placeholder="Nytt lösenord" />
            <input v-model="passwordConfirm" type="password" placeholder="Bekräfta nytt lösenord" />
            <button class="refresh" type="submit" :disabled="passwordLoading">
              {{ passwordLoading ? 'Sparar...' : 'Byt lösenord' }}
            </button>
          </form>

          <p v-if="passwordStatus" class="updated">{{ passwordStatus }}</p>
        </template>

        <template v-else>
          <p class="lead">Logga in som admin för att lägga till eller ta bort källor.</p>
          <button class="refresh" @click="openAuthModal">Logga in</button>

          <h2>Aktiva källor</h2>
          <ul v-if="sources.length" class="source-list source-name-list">
            <li v-for="source in sources" :key="source.id">
              <strong>{{ source.name }}</strong>
            </li>
          </ul>
          <p v-else class="lead">Inga källor tillagda än.</p>
        </template>
      </section>

      <section v-if="currentView === 'favorites'" class="hero source-panel">
        <h2>Favoriter</h2>

        <template v-if="!userAuthReady">
          <p class="lead">Laddar användarstatus...</p>
        </template>

        <template v-else-if="!userAuthenticated">
          <p class="lead">Registrera dig eller logga in för att spara favoritspelningar.</p>

          <div class="user-auth-grid">
            <form class="login-form user-auth-form" @submit.prevent="registerRegularUser">
              <h3>Skapa konto</h3>
              <input v-model="userRegisterUsername" type="text" placeholder="Användarnamn" />
              <input v-model="userRegisterPassword" type="password" placeholder="Lösenord" />
              <button class="refresh" type="submit" :disabled="userLoading">Registrera</button>
            </form>

            <form class="login-form user-auth-form" @submit.prevent="loginRegularUser">
              <h3>Logga in</h3>
              <input v-model="userLoginUsername" type="text" placeholder="Användarnamn" />
              <input v-model="userLoginPassword" type="password" placeholder="Lösenord" />
              <button class="refresh" type="submit" :disabled="userLoading">Logga in</button>
            </form>
          </div>

          <p v-if="userError" class="updated">{{ userError }}</p>
          <p v-if="userStatus" class="updated">{{ userStatus }}</p>
        </template>

        <template v-else>
          <div class="auth-header">
            <p class="lead">Inloggad som <strong>{{ appUser.username }}</strong></p>
            <button class="link-button" @click="logoutRegularUser">Logga ut användare</button>
          </div>

          <p v-if="userStatus" class="updated">{{ userStatus }}</p>

          <div v-if="favoriteConcerts.length" class="list compact-list">
            <article
              v-for="concert in favoriteConcerts"
              :key="`fav-${concert.artist}-${concert.date}-${concert.venue}`"
              class="card"
            >
              <div class="meta">
                <img
                  v-if="getConcertImageUrl(concert)"
                  class="concert-image"
                  :src="getConcertImageUrl(concert)"
                  :alt="`Bild för ${concert.title}`"
                  loading="lazy"
                />
                <p>{{ formatDate(concert.date) }}</p>
                <p>{{ concert.city }}</p>
              </div>

              <div class="content">
                <h3>{{ concert.artist }}</h3>
                <p class="title">{{ concert.title }}</p>
                <p class="venue">{{ concert.venue }}</p>
                <p v-if="getConcertGenre(concert)" class="genre">{{ getConcertGenre(concert) }}</p>
                <p class="source">{{ getConcertSourceName(concert) }}</p>
                <button class="link-button favorite" @click="toggleFavorite(concert)">
                  Ta bort favorit
                </button>
                <a
                  v-if="getConcertDetailsUrl(concert)"
                  class="readmore"
                  :href="getConcertDetailsUrl(concert)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Läs mer
                </a>
              </div>
            </article>
          </div>

          <p v-else class="lead">Du har inga sparade favoriter än.</p>
        </template>
      </section>

      <section v-if="currentView === 'concerts'" class="hero source-filter">
        <div class="filter-header">
          <h2>Filtrera spelningar</h2>
        </div>

        <p class="filter-title">Källor</p>
        <div class="filter-actions">
          <button class="link-button neutral" @click="selectAllSources">Välj alla källor</button>
          <button class="link-button neutral" @click="deselectAllSources">Välj inga källor</button>
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

        <p v-if="availableMonthNumbers.length" class="filter-title">Månader</p>
        <div v-if="availableMonthNumbers.length" class="filter-actions">
          <button class="link-button neutral" @click="selectAllMonths">Välj alla månader</button>
          <button class="link-button neutral" @click="deselectAllMonths">Välj inga månader</button>
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

        <p v-if="availableGenreLabels.length" class="filter-title">Genrer</p>
        <div v-if="availableGenreLabels.length" class="filter-actions">
          <button class="link-button neutral" @click="selectAllGenres">Välj alla genrer</button>
          <button class="link-button neutral" @click="deselectAllGenres">Välj inga genrer</button>
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
      </section>

      <section v-if="currentView === 'concerts' && groupedByYearAndMonth.length" class="list">
        <article v-for="group in groupedByYearAndMonth" :key="group.year" class="year-group">
          <h2>{{ group.year }}</h2>

          <section v-for="monthGroup in group.months" :key="monthGroup.month" class="month-group">
            <h3 class="month-heading">{{ monthGroup.label }}</h3>

            <article
              v-for="concert in monthGroup.concerts"
              :key="`${concert.artist}-${concert.date}-${concert.venue}`"
              class="card"
            >
              <div class="meta">
                <img
                  v-if="getConcertImageUrl(concert)"
                  class="concert-image"
                  :src="getConcertImageUrl(concert)"
                  :alt="`Bild för ${concert.title}`"
                  loading="lazy"
                />
                <p>{{ formatDate(concert.date) }}</p>
                <p>{{ concert.city }}</p>
              </div>

              <div class="content">
                <h3>{{ concert.artist }}</h3>
                <p class="title">{{ concert.title }}</p>
                <p class="venue">{{ concert.venue }}</p>
                <p v-if="getConcertGenre(concert)" class="genre">{{ getConcertGenre(concert) }}</p>
                <p class="source">{{ getConcertSourceName(concert) }}</p>
                <button class="link-button favorite" @click="toggleFavorite(concert)">
                  {{ isFavorite(concert) ? 'Ta bort favorit' : 'Spara favorit' }}
                </button>
                <a
                  v-if="getConcertDetailsUrl(concert)"
                  class="readmore"
                  :href="getConcertDetailsUrl(concert)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Läs mer
                </a>
              </div>
            </article>
          </section>
        </article>
      </section>

      <section v-if="currentView === 'concerts' && !groupedByYearAndMonth.length" class="hero">
        <p class="lead">Inga konserter lagrade än.</p>
      </section>

      <section v-if="fetchErrors.length && currentView !== 'sources'" class="hero errors">
        <h2>Kunde inte läsa vissa källor</h2>
        <ul>
          <li v-for="(error, index) in fetchErrors" :key="index">{{ error }}</li>
        </ul>
      </section>
    </template>

    <div v-if="showAuthModal && !isAuthenticated" class="modal-backdrop" @click.self="closeAuthModal">
      <section class="modal-card">
        <div class="auth-header">
          <h2>Admin-inloggning</h2>
          <button class="link-button neutral" @click="closeAuthModal">Stäng</button>
        </div>
        <p class="lead">Endast inloggad admin kan lägga till och ta bort källor.</p>

        <form class="login-form modal-login" @submit.prevent="login">
          <input v-model="loginUsername" type="text" placeholder="Användarnamn" />
          <input v-model="loginPassword" type="password" placeholder="Lösenord" />
          <button class="refresh" type="submit" :disabled="authLoading">
            {{ authLoading ? 'Loggar in...' : 'Logga in' }}
          </button>
        </form>

        <p v-if="authError" class="updated">{{ authError }}</p>
      </section>
    </div>
  </main>
</template>
