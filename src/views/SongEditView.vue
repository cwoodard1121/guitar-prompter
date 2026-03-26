<template>
  <div class="edit-view">
    <header class="edit-header">
      <button class="btn-back" @click="router.back()">← Back</button>
      <h2>{{ isNew ? 'New Song' : 'Edit Song' }}</h2>
    </header>

    <form class="edit-form" @submit.prevent="save">

      <!-- ── YouTube URL (top — triggers auto-fill) ── -->
      <div class="field-group">
        <div class="field-label">YouTube Link</div>
        <div class="yt-input-row">
          <input v-model="youtubeUrlInput" type="text" placeholder="https://youtube.com/watch?v=..." />
          <span v-if="form.youtubeId && !parseStatus" class="badge badge-ok">✓</span>
          <button v-if="form.youtubeId" type="button" class="btn-icon" @click="youtubeUrlInput = ''; form.youtubeId = null">✕</button>
        </div>
        <div v-if="parseStatus === 'loading'" class="status-row">
          <span class="status-muted">Identifying song…</span>
        </div>
        <div v-else-if="parseStatus === 'done'" class="status-row">
          <span class="badge badge-ok">✓ Auto-filled from YouTube</span>
        </div>
      </div>

      <!-- ── Title + Artist ── -->
      <div class="two-col">
        <div class="field-group">
          <div class="field-label">Title</div>
          <input v-model="form.title" type="text" placeholder="Song title" required />
        </div>
        <div class="field-group">
          <div class="field-label">Artist</div>
          <input v-model="form.artist" type="text" placeholder="Artist name" />
        </div>
      </div>

      <!-- ── Chords & Lyrics (main area) ── -->
      <div class="field-group field-grow">
        <div class="field-label-row">
          <div class="field-label">Chords &amp; Lyrics</div>
          <button type="button" class="btn-ai" :disabled="loadingLyrics || !form.title" @click="suggestWithLyrics">
            {{ loadingLyrics ? 'Fetching…' : '🤖 AI fill' }}
          </button>
        </div>
        <span class="hint">Use [brackets] for chords above lyric lines</span>
        <textarea
          v-model="form.content"
          placeholder="[G]Here comes the [C]sun..."
          rows="14"
          spellcheck="false"
        ></textarea>
        <div v-if="loadingLyrics" class="progress-bar-track">
          <div class="progress-bar-fill"></div>
          <div class="progress-label">{{ loadingPhase }}</div>
        </div>
        <span v-if="chordError" class="status-err">{{ chordError }}</span>
      </div>

      <!-- ── Paste from tab (collapsible) ── -->
      <details class="collapsible">
        <summary class="collapsible-header">Paste from tab site</summary>
        <div class="collapsible-body">
          <span class="hint">Paste chords/lyrics from Ultimate Guitar or similar — we'll format it</span>
          <textarea
            v-model="pasteText"
            placeholder="Paste tab text here..."
            rows="8"
            spellcheck="false"
          ></textarea>
          <div class="format-row">
            <button type="button" class="btn-secondary" :disabled="!pasteText.trim()" @click="formatPaste">
              Format &amp; import
            </button>
            <span v-if="checking" class="check-status">AI checking...</span>
            <span v-if="checkError" class="check-error">{{ checkError }}</span>
          </div>
        </div>
      </details>

      <!-- ── Sync section ── -->
      <div class="sync-section">
        <div class="sync-row">
          <!-- LRC Sync -->
          <button
            type="button"
            class="btn-lrc"
            :disabled="lrcStatus === 'loading' || !form.title || !form.artist"
            @click="fetchLrcSync"
          >{{ lrcStatus === 'loading' ? 'Fetching…' : '⏱ Fetch Sync' }}</button>
          <span v-if="lrcStatus === 'found'" class="badge badge-ok">✓ Synced</span>
          <span v-else-if="lrcStatus === 'not_found'" class="status-warn">No sync available</span>
          <span v-else-if="lrcStatus === 'error'" class="status-err">Fetch failed</span>
          <span v-else-if="form.syncedLyrics" class="badge badge-ok">✓ Sync stored</span>
          <button v-if="form.syncedLyrics" type="button" class="btn-icon" @click="form.syncedLyrics = null; lrcStatus = 'idle'">✕</button>
        </div>
        <div v-if="lrcMeta" class="lrc-meta">
          {{ lrcMeta.albumName ? `"${lrcMeta.albumName}"` : '' }}
          {{ lrcMeta.duration ? `· ${Math.floor(lrcMeta.duration / 60)}:${String(lrcMeta.duration % 60).padStart(2,'0')}` : '' }}
          — match this version on YouTube for best sync
        </div>

        <!-- Sync offset (only when LRC data present) -->
        <div v-if="form.syncedLyrics" class="bpm-row">
          <span class="field-label">Sync offset</span>
          <button type="button" class="btn-tap" @click="adjustSyncOffset(-0.5)">−½s</button>
          <span class="bpm-input offset-display">{{ syncOffsetDisplay }}</span>
          <button type="button" class="btn-tap" @click="adjustSyncOffset(0.5)">+½s</button>
          <button v-if="savedSyncOffset !== 0" type="button" class="btn-icon" @click="resetSyncOffset">✕</button>
          <span class="hint" style="text-transform:none;letter-spacing:0">Saved for this song</span>
        </div>

        <!-- BPM tap tempo -->
        <div class="bpm-row">
          <span class="field-label">BPM</span>
          <button type="button" class="btn-tap" @click="tap">Tap</button>
          <input
            v-model.number="form.bpm"
            type="number"
            class="bpm-input"
            min="20"
            max="300"
            placeholder="—"
          />
          <button v-if="form.bpm" type="button" class="btn-icon" @click="form.bpm = null">✕</button>
          <span class="hint" style="text-transform:none;letter-spacing:0">Used when no sync data</span>
        </div>
      </div>

      <!-- ── Preview ── -->
      <ChordChart :content="form.content" />

      <!-- ── Actions ── -->
      <div class="form-actions">
        <button type="submit" class="btn-save">Save</button>
        <RouterLink v-if="!isNew" :to="`/song/${route.params.id}/play`" class="btn-play">▶ Play</RouterLink>
      </div>

    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import ChordChart from '../components/ChordChart.vue'
import { parseTabText } from '../utils/parseTab.js'

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const isNew = computed(() => route.params.id === undefined)

const form = ref({ title: '', artist: '', content: '', syncedLyrics: null, youtubeId: null, bpm: null })
const pasteText = ref('')
const checking = ref(false)
const checkError = ref('')
const loadingLyrics = ref(false)
const chordError = ref('')
const loadingPhase = ref('')
const lrcStatus = ref('idle') // 'idle' | 'loading' | 'found' | 'not_found' | 'error'
const lrcMeta = ref(null)
const youtubeUrlInput = ref('')
const parseStatus = ref('') // '' | 'loading' | 'done'
let suppressNextParse = false // skip auto-fill when pre-populating on edit

watch(youtubeUrlInput, async (url) => {
  if (suppressNextParse) { suppressNextParse = false; return }
  const m = url.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/)
  const videoId = m ? m[1] : null
  form.value.youtubeId = videoId
  if (!videoId) { parseStatus.value = ''; return }

  parseStatus.value = 'loading'
  try {
    // Step 1: oEmbed (no API key, fast)
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
    if (!res.ok) { parseStatus.value = ''; return }
    const { title: rawTitle } = await res.json()

    // Step 2: heuristic parse first (instant)
    const heuristic = parseYouTubeTitle(rawTitle)
    if (!form.value.title) form.value.title = heuristic.title
    if (!form.value.artist) form.value.artist = heuristic.artist

    // Step 3: AI parse as fallback/improvement
    try {
      const aiRes = await fetch(`/api/parse-title?raw=${encodeURIComponent(rawTitle)}`)
      if (aiRes.ok) {
        const ai = await aiRes.json()
        if (ai.title) form.value.title = ai.title
        if (ai.artist) form.value.artist = ai.artist
      }
    } catch { /* keep heuristic result */ }

    parseStatus.value = 'done'
  } catch {
    parseStatus.value = ''
  }
})

function parseYouTubeTitle(raw) {
  const clean = raw
    .replace(/\s*[\[(](?:official\s*(?:video|music\s*video|audio|lyric\s*video)?|lyrics?|hd|4k|live|audio|visualizer)[^\])]*/gi, '')
    .replace(/\s*\|.*$/, '')
    .trim()
  const parts = clean.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  }
  return { artist: '', title: clean }
}

// BPM tap tempo
let tapTimes = []
let tapTimer = null
function tap() {
  const now = Date.now()
  tapTimes.push(now)
  clearTimeout(tapTimer)
  tapTimer = setTimeout(() => { tapTimes = [] }, 3000)
  if (tapTimes.length >= 2) {
    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i])
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    form.value.bpm = Math.round(60000 / avg)
  }
}

async function formatPaste() {
  if (!pasteText.value.trim()) return
  form.value.content = parseTabText(pasteText.value)
  pasteText.value = ''
  aiCheckFormat(form.value.content)
}

async function aiCheckFormat(content) {
  checking.value = true
  checkError.value = ''
  try {
    const res = await fetch('/api/chords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.content) form.value.content = data.content
  } catch {
    checkError.value = 'AI check failed — using formatted output as-is'
  } finally {
    checking.value = false
  }
}

const LOADING_PHASES = [
  'Fetching lyrics...',
  'Researching chord progressions...',
  'Analyzing guitar tabs...',
  'Verifying accuracy...',
  'Building chord chart...',
]
let loadingInterval = null

function startLoadingPhases() {
  let idx = 0
  loadingPhase.value = LOADING_PHASES[0]
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % LOADING_PHASES.length
    loadingPhase.value = LOADING_PHASES[idx]
  }, 3000)
}

function stopLoadingPhases() {
  if (loadingInterval) clearInterval(loadingInterval)
  loadingInterval = null
  loadingPhase.value = ''
}

function parseChordResponse(data) {
  if (typeof data.content === 'string' && !data.content.trim().startsWith('{')) {
    return data.content
  }
  let json
  try {
    json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
  } catch {
    return data.content || ''
  }
  if (!json.sections || !Array.isArray(json.sections)) return data.content || ''
  const lines = []
  if (json.capo && json.capo > 0) { lines.push(`[capo ${json.capo}]`); lines.push('') }
  if (json.source) { lines.push(`// Source: ${json.source}`); lines.push('') }
  for (const section of json.sections) {
    if (section.name) lines.push('')
    for (const line of section.lines || []) {
      if (line.chords?.length > 0) lines.push(line.chords.map(c => `[${c}]`).join('  '))
      if (line.text) lines.push(line.text)
    }
  }
  return lines.join('\n')
}

// ── Sync offset (localStorage, per song) ────────────────────────────────────
const savedSyncOffset = ref(0)
const syncOffsetDisplay = computed(() => {
  const v = savedSyncOffset.value
  if (v === 0) return '0s'
  return (v > 0 ? '+' : '') + v.toFixed(1) + 's'
})

function syncOffsetKey() { return `gp-sync-offset-${route.params.id}` }

function adjustSyncOffset(delta) {
  savedSyncOffset.value = Math.round((savedSyncOffset.value + delta) * 10) / 10
  localStorage.setItem(syncOffsetKey(), String(savedSyncOffset.value))
}

function resetSyncOffset() {
  savedSyncOffset.value = 0
  localStorage.removeItem(syncOffsetKey())
}

onMounted(() => {
  if (!isNew.value) {
    const song = store.getSong(route.params.id)
    if (song) {
      form.value = { title: song.title, artist: song.artist, content: song.content, syncedLyrics: song.syncedLyrics ?? null, youtubeId: song.youtubeId ?? null, bpm: song.bpm ?? null }
      if (song.youtubeId) {
        suppressNextParse = true
        youtubeUrlInput.value = `https://www.youtube.com/watch?v=${song.youtubeId}`
      }
      const saved = parseFloat(localStorage.getItem(syncOffsetKey()) || '0')
      savedSyncOffset.value = isNaN(saved) ? 0 : saved
    } else {
      router.replace('/')
    }
  }
})

async function fetchLrcSync() {
  if (!form.value.title || !form.value.artist) return
  lrcStatus.value = 'loading'
  try {
    const params = new URLSearchParams({ artist_name: form.value.artist, track_name: form.value.title })
    const res = await fetch(`https://lrclib.net/api/get?${params}`, { headers: { 'Lrclib-Client': 'guitar-prompter/1.0' } })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    if (data.syncedLyrics) {
      form.value.syncedLyrics = data.syncedLyrics
      lrcStatus.value = 'found'
      lrcMeta.value = { albumName: data.albumName || null, duration: data.duration || null }
    } else {
      lrcStatus.value = 'not_found'
    }
  } catch {
    lrcStatus.value = 'error'
  }
}

async function save() {
  try {
    if (isNew.value) {
      await store.addSong(form.value)
    } else {
      await store.updateSong(route.params.id, form.value)
    }
    router.push('/')
  } catch (e) {
    chordError.value = 'Failed to save: ' + (e.message || 'Unknown error')
  }
}

async function suggestWithLyrics() {
  loadingLyrics.value = true
  chordError.value = ''
  startLoadingPhases()
  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(form.value.title)}&artist=${encodeURIComponent(form.value.artist)}`)
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Could not fetch lyrics.')
    }
    const data = await res.json()
    form.value.content = parseChordResponse(data)
  } catch (e) {
    chordError.value = e.message || 'Could not fetch lyrics and chords.'
  } finally {
    stopLoadingPhases()
    loadingLyrics.value = false
  }
}
</script>

<style scoped>
.edit-view {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 1rem;
  gap: 1rem;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 1rem;
  padding: 0.4rem 0;
}

.edit-header h2 { font-size: 1.2rem; }

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  flex: 1;
}

/* Field groups */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-grow { flex: 1; }

.field-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Inputs */
input, textarea {
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.75rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(233,69,96,0.15);
  outline: none;
}
textarea {
  resize: vertical;
  line-height: 1.6;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
}

/* YouTube row */
.yt-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.yt-input-row input { flex: 1; }

/* Badges / status */
.badge {
  font-size: 0.78rem;
  padding: 0.25rem 0.55rem;
  border-radius: 99px;
  white-space: nowrap;
}
.badge-ok { background: rgba(76,175,80,0.15); color: #4caf50; }
.status-row { display: flex; align-items: center; gap: 0.5rem; }
.status-muted { font-size: 0.8rem; color: var(--text-muted); }
.status-warn { font-size: 0.8rem; color: #ff9800; }
.status-err { font-size: 0.8rem; color: var(--accent); }

/* Icon button (✕) */
.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  flex-shrink: 0;
  cursor: pointer;
}

/* AI fill button (inline in label row) */
.btn-ai {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

/* Progress bar */
.progress-bar-track {
  background: var(--bg);
  border-radius: 99px;
  height: 5px;
  overflow: hidden;
  position: relative;
  margin-top: 0.25rem;
}
.progress-bar-fill {
  position: absolute; top: 0; left: 0; height: 100%; width: 40%;
  background: var(--accent); border-radius: 99px;
  animation: progress-slide 1.8s ease-in-out infinite;
}
@keyframes progress-slide {
  0%   { left: -40%; }
  100% { left: 100%; }
}
.progress-label {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

/* Collapsible paste section */
.collapsible {
  border: 1px solid #2a2a3e;
  border-radius: var(--radius);
  overflow: hidden;
}
.collapsible-header {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.collapsible-header::before { content: '▶'; font-size: 0.65rem; transition: transform 0.2s; }
details[open] .collapsible-header::before { transform: rotate(90deg); }
.collapsible-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 1rem 1rem;
}

/* Secondary button */
.btn-secondary {
  background: var(--accent2);
  color: var(--text);
  border: none;
  border-radius: var(--radius);
  padding: 0.55rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  align-self: flex-start;
  cursor: pointer;
}
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Sync section */
.sync-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
}

.sync-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-lrc {
  background: rgba(245, 197, 24, 0.12);
  color: #f5c518;
  border: 1px solid rgba(245, 197, 24, 0.25);
  border-radius: var(--radius);
  padding: 0.45rem 0.9rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-lrc:disabled { opacity: 0.4; cursor: not-allowed; }

.lrc-meta { font-size: 0.75rem; color: #888; }

.bpm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn-tap {
  background: var(--accent2);
  color: var(--text);
  border: none;
  border-radius: var(--radius);
  padding: 0.45rem 0.85rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}
.offset-display {
  min-width: 3.5rem;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--chord);
}

.bpm-input {
  width: 5rem;
  text-align: center;
  background: var(--bg);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.45rem;
  font-size: 1rem;
}

/* Actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1.5rem;
}
.btn-save {
  flex: 1;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.9rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-play {
  background: var(--accent2);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.format-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.check-status {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.check-error {
  font-size: 0.8rem;
  color: var(--accent);
}
</style>
