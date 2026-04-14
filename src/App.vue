<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  clearStoredConcerts,
  loadStoredConcerts,
  updateConcertsFromSources
} from './services/concertStore'
import { addSource, loadSources, removeSource } from './services/sourceStore'

const concerts = ref([])
const sources = ref([])
const loading = ref(false)
const status = ref('')
const sourceStatus = ref('')
const fetchErrors = ref([])

const isAuthenticated = ref(false)
const authReady = ref(false)
const authError = ref('')
const loginUsername = ref('')
const loginPassword = ref('')
const authLoading = ref(false)

const passwordCurrent = ref('')
const passwordNext = ref('')
const passwordConfirm = ref('')
const passwordLoading = ref(false)
const passwordStatus = ref('')

const newSourceName = ref('')
const newSourceUrl = ref('')
const deselectedSources = ref([])
const deselectedMonths = ref([])

const monthFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'long' })

function getConcertDate(concert) {
  const date = new Date(concert?.date)
  return Number.isNaN(date.getTime()) ? null : date
}

function getConcertSourceName(concert) {
  const sourceName = String(concert?.sourceName || '').trim()
  return sourceName || 'Okänd källa'
}

function getConcertGenre(concert) {
  return String(concert?.genre || '').trim()
}

function getConcertDetailsUrl(concert) {
  return String(concert?.detailsUrl || '').trim()
}

function getConcertImageUrl(concert) {
  return String(concert?.imageUrl || '').trim()
}

const availableSourceNames = computed(() => {
  return [...new Set(concerts.value.map((concert) => getConcertSourceName(concert)))].sort((a, b) =>
    a.localeCompare(b, 'sv-SE')
  )
})

function getConcertMonth(concert) {
  const date = getConcertDate(concert)
  return date ? date.getMonth() : null
}

function getMonthLabel(monthNumber) {
  return monthFormatter.format(new Date(Date.UTC(2024, monthNumber, 1)))
}

const availableMonthNumbers = computed(() => {
  const months = concerts.value
    .map((concert) => getConcertMonth(concert))
    .filter((month) => month !== null)

  return [...new Set(months)].sort((a, b) => a - b)
})

const filteredConcerts = computed(() => {
  return concerts.value.filter((concert) => {
    const sourceIncluded = !deselectedSources.value.includes(getConcertSourceName(concert))
    const month = getConcertMonth(concert)
    const monthIncluded = month === null || !deselectedMonths.value.includes(month)

    return sourceIncluded && monthIncluded
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
  } finally {
    authLoading.value = false
  }
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

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId)

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function handleAuthMenuAction() {
  if (isAuthenticated.value) {
    await logout()
    status.value = 'Du är utloggad.'
    scrollToSection('home')
    return
  }

  scrollToSection('sources')
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
    await Promise.all([checkAuth(), refreshConcerts()])
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
        <button class="nav-link" @click="scrollToSection('home')">Hem</button>
        <button class="nav-link" @click="scrollToSection('sources')">Källor</button>
        <button class="nav-link" @click="scrollToSection('concerts')">Spelningar</button>
        <button class="nav-link" @click="handleAuthMenuAction">
          {{ isAuthenticated ? 'Logga ut' : 'Logga in' }}
        </button>
      </nav>
    </header>

    <header id="home" class="hero">
      <p class="kicker">Konsertnavigator</p>
      <h1>Hantera källor och samla konserter</h1>
      <p class="lead">
        Lägg till datakällor, uppdatera och fyll på med nya konserter. Befintliga poster tas
        aldrig bort vid uppdatering.
      </p>

      <div class="actions">
        <button class="refresh" @click="updateConcerts" :disabled="loading">
          {{ loading ? 'Uppdaterar...' : 'Uppdatera konserter' }}
        </button>
        <button
          v-if="isAuthenticated"
          class="refresh danger"
          @click="clearConcerts"
          :disabled="loading"
        >
          Töm konserter
        </button>
        <p v-if="status" class="updated">{{ status }}</p>
      </div>
    </header>

    <section v-if="!authReady" class="hero">
      <p class="lead">Laddar inloggningsstatus...</p>
    </section>

    <section v-else-if="isAuthenticated" id="sources" class="hero source-panel">
      <div class="auth-header">
        <h2>Källor</h2>
        <button class="link-button" @click="logout">Logga ut</button>
      </div>

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
    </section>

    <section v-if="isAuthenticated" class="hero source-panel">
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
    </section>

    <section v-else id="sources" class="hero source-panel">
      <h2>Admin-inloggning</h2>
      <p class="lead">Endast inloggad admin kan lägga till och ta bort källor.</p>

      <form class="login-form" @submit.prevent="login">
        <input v-model="loginUsername" type="text" placeholder="Användarnamn" />
        <input v-model="loginPassword" type="password" placeholder="Lösenord" />
        <button class="refresh" type="submit" :disabled="authLoading">
          {{ authLoading ? 'Loggar in...' : 'Logga in' }}
        </button>
      </form>

      <p v-if="authError" class="updated">{{ authError }}</p>

      <h2>Aktiva källor</h2>
      <ul v-if="sources.length" class="source-list source-name-list">
        <li v-for="source in sources" :key="source.id">
          <strong>{{ source.name }}</strong>
        </li>
      </ul>
      <p v-else class="lead">Inga källor tillagda än.</p>
    </section>

    <section v-if="fetchErrors.length" class="hero errors">
      <h2>Kunde inte läsa vissa källor</h2>
      <ul>
        <li v-for="(error, index) in fetchErrors" :key="index">{{ error }}</li>
      </ul>
    </section>

    <section v-if="availableSourceNames.length" class="hero source-filter">
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
    </section>

    <section v-if="groupedByYearAndMonth.length" id="concerts" class="list">
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

    <section v-else id="concerts" class="hero">
      <p class="lead">Inga konserter lagrade än.</p>
    </section>
  </main>
</template>
