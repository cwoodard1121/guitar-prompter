<template>
  <div class="edit-view">
    <h1 class="page-title">{{ isNew ? 'New Song' : 'Edit Song' }}</h1>

    <form class="edit-form" @submit.prevent="save">

      <!-- ── YouTube URL (top — triggers auto-fill) ── -->
      <div class="field-group">
        <div class="field-label">YouTube Link</div>
        <div class="yt-input-row">
          <input v-model="youtubeUrlInput" type="text" placeholder="https://youtube.com/watch?v=..." />
          <span v-if="form.youtubeId && !parseStatus" class="badge badge-ok">✓</span>
          <button v-if="form.youtubeId" type="button" class="btn-icon" @click="youtubeUrlInput = ''; form.youtubeId = null"><X :size="13" /></button>
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
          <div class="field-actions">
            <button type="button" class="btn-format" :disabled="!form.content.trim() || checking" @click="formatContent">
              {{ checking ? 'Formatting…' : 'Format' }}
            </button>
            <button v-if="settings.experimentalFeatures" type="button" class="btn-ai" :disabled="loadingLyrics || !form.title" @click="suggestWithLyrics">
              <Sparkles v-if="!loadingLyrics" :size="13" /> {{ loadingLyrics ? 'Fetching…' : 'AI fill' }}
            </button>
          </div>
        </div>
        <span class="hint">Paste from Ultimate Guitar or similar, then tap Format</span>
        <textarea
          v-model="form.content"
          placeholder="Paste tab here, or use AI fill above..."
          rows="14"
          spellcheck="false"
        ></textarea>
        <div v-if="loadingLyrics" class="progress-bar-track">
          <div class="progress-bar-fill"></div>
          <div class="progress-label">{{ loadingPhase }}</div>
        </div>
        <span v-if="checking" class="check-status">Cleaning up format…</span>
        <span v-if="checkError" class="check-error">{{ checkError }}</span>
        <span v-if="chordError" class="status-err">{{ chordError }}</span>
      </div>

      <!-- ── Sync section ── -->
      <div class="sync-section">
        <div class="sync-row">
          <!-- LRC Sync -->
          <button
            type="button"
            class="btn-lrc"
            :disabled="lrcStatus === 'loading' || !form.title || !form.artist"
            @click="fetchLrcSync"
          ><Clock v-if="lrcStatus !== 'loading'" :size="13" /> {{ lrcStatus === 'loading' ? 'Fetching…' : 'Fetch Sync' }}</button>
          <span v-if="lrcStatus === 'found'" class="badge badge-ok">✓ Synced</span>
          <span v-else-if="lrcStatus === 'not_found'" class="status-warn">No sync available</span>
          <span v-else-if="lrcStatus === 'error'" class="status-err">Fetch failed</span>
          <span v-else-if="form.syncedLyrics" class="badge badge-ok">✓ Sync stored</span>
          <button v-if="form.syncedLyrics" type="button" class="btn-icon" @click="form.syncedLyrics = null; lrcStatus = 'idle'"><X :size="13" /></button>
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
          <button v-if="form.syncOffset !== 0" type="button" class="btn-icon" @click="resetSyncOffset"><X :size="13" /></button>
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
          <button v-if="form.bpm" type="button" class="btn-icon" @click="form.bpm = null"><X :size="13" /></button>
          <span class="hint" style="text-transform:none;letter-spacing:0">Used when no sync data</span>
        </div>

        <!-- Share publicly toggle -->
        <div class="public-row">
          <div class="public-info">
            <span class="field-label">Share publicly</span>
            <span class="hint" style="text-transform:none;letter-spacing:0">Makes this song visible in the Community section</span>
          </div>
          <button
            type="button"
            class="toggle"
            :class="{ on: form.isPublic }"
            @click="form.isPublic = !form.isPublic"
            :aria-pressed="form.isPublic"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>

      <!-- ── Preview ── -->
      <ChordChart :content="form.content" />

      <!-- ── Actions ── -->
      <div class="form-actions">
        <button type="submit" class="btn-save">Save</button>
        <RouterLink v-if="!isNew" :to="`/song/${route.params.id}/play`" class="btn-play"><Play :size="15" /> Play</RouterLink>
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
import { useSettings } from '../composables/useSettings.js'
import { X, Sparkles, Clock, Play } from 'lucide-vue-next'

const { settings } = useSettings()

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const isNew = computed(() => route.params.id === undefined)

const form = ref({ title: '', artist: '', content: '', syncedLyrics: null, youtubeId: null, bpm: null, syncOffset: 0, isPublic: false })
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

async function formatContent() {
  if (!form.value.content.trim()) return
  form.value.content = parseTabText(form.value.content)
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
  'Fetching lyrics…',
  'Adding chord annotations…',
  'Verifying progressions…',
  'Building chord chart…',
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

// ── Sync offset (stored in DB as part of song) ──────────────────────────────
const syncOffsetDisplay = computed(() => {
  const v = form.value.syncOffset ?? 0
  if (v === 0) return '0s'
  return (v > 0 ? '+' : '') + v.toFixed(1) + 's'
})

function adjustSyncOffset(delta) {
  form.value.syncOffset = Math.round(((form.value.syncOffset ?? 0) + delta) * 10) / 10
}

function resetSyncOffset() {
  form.value.syncOffset = 0
}

onMounted(() => {
  if (!isNew.value) {
    const song = store.getSong(route.params.id)
    if (song) {
      form.value = { title: song.title, artist: song.artist, content: song.content, syncedLyrics: song.syncedLyrics ?? null, youtubeId: song.youtubeId ?? null, bpm: song.bpm ?? null, syncOffset: song.syncOffset ?? 0, isPublic: song.isPublic ?? false }
      if (song.youtubeId) {
        suppressNextParse = true
        youtubeUrlInput.value = `https://www.youtube.com/watch?v=${song.youtubeId}`
      }
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
  gap: 1.1rem;
}

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
  gap: 0.45rem;
}

.field-grow { flex: 1; }

.field-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  font-weight: 600;
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
  font-size: 0.73rem;
  color: var(--text-muted);
}

/* Inputs */
input, textarea {
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.75rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
  box-sizing: border-box;
}
input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
  outline: none;
}
textarea {
  resize: vertical;
  line-height: 1.6;
  font-family: var(--font-mono);
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
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  white-space: nowrap;
  font-weight: 600;
}
.badge-ok { background: rgba(76,175,80,0.15); color: #5dbf61; }
.status-row { display: flex; align-items: center; gap: 0.5rem; }
.status-muted { font-size: 0.8rem; color: var(--text-muted); }
.status-warn { font-size: 0.8rem; color: #f5a623; }
.status-err { font-size: 0.8rem; color: var(--accent); }

/* Icon button (✕) */
.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.25rem 0.45rem;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
}
.btn-icon:active { background: rgba(255,255,255,0.08); color: var(--text); }

.field-actions { display: flex; gap: 0.4rem; }

/* Format button (secondary) */
.btn-format {
  background: rgba(255,255,255,0.07);
  color: var(--text);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-sm);
  padding: 0.38rem 0.8rem;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-format:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-format:active { opacity: 0.75; }

/* AI fill button */
.btn-ai {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.9rem;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 6px var(--accent-glow);
}
.btn-ai:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

/* Progress bar */
.progress-bar-track {
  background: var(--bg);
  border-radius: 99px;
  height: 4px;
  overflow: hidden;
  position: relative;
  margin-top: 0.3rem;
}
.progress-bar-fill {
  position: absolute; top: 0; left: 0; height: 100%; width: 40%;
  background: linear-gradient(90deg, var(--accent), #ff6b8a);
  border-radius: 99px;
  animation: progress-slide 1.8s ease-in-out infinite;
}
@keyframes progress-slide {
  0%   { left: -40%; }
  100% { left: 100%; }
}
.progress-label {
  margin-top: 0.4rem;
  font-size: 0.73rem;
  color: var(--text-muted);
  text-align: center;
}


/* Sync section */
.sync-section {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
  box-shadow: var(--shadow-sm);
}

.sync-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-lrc {
  background: rgba(245, 197, 24, 0.1);
  color: #f5c518;
  border: 1px solid rgba(245, 197, 24, 0.22);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-lrc:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-lrc:active { opacity: 0.75; }

.lrc-meta { font-size: 0.73rem; color: var(--text-muted); }

.bpm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn-tap {
  background: rgba(255,255,255,0.07);
  color: var(--text);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-tap:active { opacity: 0.75; transform: scale(0.96); }

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
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-sm);
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
  box-shadow: 0 3px 12px var(--accent-glow);
  letter-spacing: 0.01em;
}
.btn-save:active { opacity: 0.88; transform: scale(0.98); }
.btn-play {
  background: rgba(255,255,255,0.07);
  color: var(--text);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
}
.btn-play:active { opacity: 0.75; }

.check-status {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.check-error {
  font-size: 0.78rem;
  color: var(--accent);
}

/* Share publicly row */
.public-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-subtle);
}

.public-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

/* Toggle */
.toggle {
  width: 2.6rem;
  height: 1.4rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid var(--border-subtle);
  border-radius: 99px;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
  padding: 0;
}
.toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle.on .toggle-thumb {
  transform: translateX(1.2rem);
}
</style>
