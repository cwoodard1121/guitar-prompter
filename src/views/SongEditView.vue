<template>
  <div class="edit-view">
    <header class="edit-header">
      <button class="btn-back" @click="router.back()">← Back</button>
      <h2>{{ isNew ? 'New Song' : 'Edit Song' }}</h2>
    </header>

    <form class="edit-form" @submit.prevent="save">
      <label>
        Title
        <input v-model="form.title" type="text" placeholder="Song title" required />
      </label>

      <label>
        Artist
        <input v-model="form.artist" type="text" placeholder="Artist name" />
      </label>

      <label class="label-paste">
        Paste from tab site
        <span class="hint">Paste chords/lyrics from Ultimate Guitar or similar — we'll format it</span>
        <textarea
          v-model="pasteText"
          placeholder="Paste tab text here...

Example:
               E
Now, if you're feeling kinda low
D               A        E
Future's coming much too slow"
          rows="10"
          spellcheck="false"
        ></textarea>
        <button type="button" class="btn-format" :disabled="!pasteText.trim()" @click="formatPaste">
          Format &amp; import
        </button>
      </label>

      <label class="label-content">
        Chords &amp; Lyrics
        <span class="hint">Edit your formatted chord chart — use [brackets] for chords</span>
        <textarea
          v-model="form.content"
          placeholder="[G]Here comes the [C]sun..."
          rows="16"
          spellcheck="false"
        ></textarea>
      </label>

      <div class="lrc-row">
        <button
          type="button"
          class="btn-suggest btn-lrc"
          :disabled="lrcStatus === 'loading' || !form.title || !form.artist"
          @click="fetchLrcSync"
        >
          {{ lrcStatus === 'loading' ? 'Fetching…' : '⏱ Fetch Sync' }}
        </button>
        <span v-if="lrcStatus === 'found'" class="lrc-ok">✓ Synced lyrics found</span>
        <span v-if="lrcMeta" class="lrc-meta">
          {{ lrcMeta.albumName ? `"${lrcMeta.albumName}"` : '' }}
          {{ lrcMeta.duration ? `· ${Math.floor(lrcMeta.duration / 60)}:${String(lrcMeta.duration % 60).padStart(2,'0')}` : '' }}
          — find this exact version on YouTube
        </span>
        <span v-else-if="lrcStatus === 'not_found'" class="lrc-warn">No synced lyrics available</span>
        <span v-else-if="lrcStatus === 'error'" class="lrc-err">Fetch failed</span>
        <span v-else-if="form.syncedLyrics" class="lrc-ok">✓ Sync data stored</span>
        <button
          v-if="form.syncedLyrics"
          type="button"
          class="btn-lrc-clear"
          @click="form.syncedLyrics = null; lrcStatus = 'idle'"
        >✕</button>
      </div>

      <label>
        YouTube
        <span class="hint">Paste a YouTube link — video will play alongside the teleprompter</span>
        <div class="yt-input-row">
          <input v-model="youtubeUrlInput" type="text" placeholder="https://youtube.com/watch?v=..." />
          <span v-if="form.youtubeId" class="lrc-ok">✓</span>
          <button v-if="form.youtubeId" type="button" class="btn-lrc-clear" @click="youtubeUrlInput = ''; form.youtubeId = null">✕</button>
        </div>
      </label>

      <!-- BPM tap tempo -->
      <div class="bpm-row">
        <span class="bpm-label">BPM</span>
        <button type="button" class="btn-tap" @click="tap">Tap</button>
        <input
          v-model.number="form.bpm"
          type="number"
          class="bpm-input"
          min="20"
          max="300"
          placeholder="—"
        />
        <button v-if="form.bpm" type="button" class="btn-lrc-clear" @click="form.bpm = null">✕</button>
        <span class="hint" style="text-transform:none;letter-spacing:0">Used when no sync data</span>
      </div>

      <div class="chord-suggest">
        <button type="button" class="btn-suggest btn-lyrics" :disabled="loadingLyrics || !form.title" @click="suggestWithLyrics">
          {{ loadingLyrics ? 'Researching…' : '🤖 AI fetch (beta)' }}
        </button>
        <span v-if="chordError" class="chord-error">{{ chordError }}</span>
      </div>

      <div v-if="loadingLyrics" class="progress-bar-track">
        <div class="progress-bar-fill"></div>
        <div class="progress-label">{{ loadingPhase }}</div>
      </div>

      <ChordChart :content="form.content" />

      <div class="form-actions">
        <button type="submit" class="btn-save">Save Song</button>
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
const loadingLyrics = ref(false)
const chordError = ref('')
const loadingPhase = ref('')
const lrcStatus = ref('idle') // 'idle' | 'loading' | 'found' | 'not_found' | 'error'
const lrcMeta = ref(null) // { albumName, duration } from LRCLIB — helps find the right YT video
const youtubeUrlInput = ref('')

watch(youtubeUrlInput, async (url) => {
  const m = url.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/)
  const videoId = m ? m[1] : null
  form.value.youtubeId = videoId
  if (!videoId) return

  // Auto-fill title/artist from YouTube video title if fields are empty
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
    if (!res.ok) return
    const { title } = await res.json()
    const parsed = parseYouTubeTitle(title)
    if (!form.value.title) form.value.title = parsed.title
    if (!form.value.artist) form.value.artist = parsed.artist
  } catch { /* silent */ }
})

function parseYouTubeTitle(raw) {
  // Strip common suffixes: (Official Video), (Lyrics), [HD], etc.
  const clean = raw
    .replace(/\s*[\[(](?:official\s*(?:video|music\s*video|audio|lyric\s*video)?|lyrics?|hd|4k|live|audio|visualizer)[^\])]*/gi, '')
    .replace(/\s*\|.*$/, '')   // strip " | Artist Name" suffix
    .trim()

  // Most music titles: "Artist - Song" or "Song - Artist"
  const parts = clean.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  }
  // Fallback: use full title as song name
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

function formatPaste() {
  if (!pasteText.value.trim()) return
  form.value.content = parseTabText(pasteText.value)
  pasteText.value = ''
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

// Convert AI JSON response to bracket format for the textarea/teleprompter
// Input: { sections: [{ name, lines: [{ chords: ["D","A"], text: "..." }] }] }
// Output: "[D]             [A]\nda da da da     da da da da\n..."
function parseChordResponse(data) {
  // If it's already a plain string (old format), return as-is
  if (typeof data.content === 'string' && !data.content.trim().startsWith('{')) {
    return data.content
  }

  // Try to parse as JSON
  let json
  try {
    // content might be a JSON string
    json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
  } catch {
    // Not JSON, return as-is
    return data.content || ''
  }

  if (!json.sections || !Array.isArray(json.sections)) {
    return data.content || ''
  }

  const lines = []

  // Add capo info if present
  if (json.capo && json.capo > 0) {
    lines.push(`[capo ${json.capo}]`)
    lines.push('')
  }

  // Add source attribution if present
  if (json.source) {
    lines.push(`// Source: ${json.source}`)
    lines.push('')
  }

  for (const section of json.sections) {
    if (section.name) lines.push('')  // blank line before section
    for (const line of section.lines || []) {
      if (line.chords && line.chords.length > 0) {
        const chordLine = line.chords.map(c => `[${c}]`).join('  ')
        lines.push(chordLine)
      }
      if (line.text) {
        lines.push(line.text)
      }
    }
  }
  return lines.join('\n')
}

onMounted(() => {
  if (!isNew.value) {
    const song = store.getSong(route.params.id)
    if (song) {
      form.value = { title: song.title, artist: song.artist, content: song.content, syncedLyrics: song.syncedLyrics ?? null, youtubeId: song.youtubeId ?? null, bpm: song.bpm ?? null }
      if (song.youtubeId) youtubeUrlInput.value = `https://www.youtube.com/watch?v=${song.youtubeId}`
    }
    else router.replace('/')
  }
})

async function fetchLrcSync() {
  if (!form.value.title || !form.value.artist) return
  lrcStatus.value = 'loading'
  try {
    const params = new URLSearchParams({
      artist_name: form.value.artist,
      track_name: form.value.title
    })
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'Lrclib-Client': 'guitar-prompter/1.0' }
    })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    if (data.syncedLyrics) {
      form.value.syncedLyrics = data.syncedLyrics
      lrcStatus.value = 'found'
      lrcMeta.value = {
        albumName: data.albumName || null,
        duration: data.duration || null
      }
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
    chordError.value = 'Failed to save song: ' + (e.message || 'Unknown error')
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

.edit-header h2 {
  font-size: 1.2rem;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
}

input, textarea {
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.75rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, textarea:focus {
  border-color: var(--accent);
}

textarea {
  resize: vertical;
  line-height: 1.6;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
}

.label-content {
  flex: 1;
}

.chord-suggest {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-suggest {
  background: var(--accent2);
  color: var(--text);
  border: none;
  border-radius: var(--radius);
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-lyrics {
  background: var(--accent);
  color: #fff;
}

.btn-suggest:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chord-error {
  color: var(--accent);
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.btn-save {
  flex: 1;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.85rem;
  font-size: 1rem;
  font-weight: 700;
}

.btn-play {
  background: var(--accent2);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.85rem 1.2rem;
  font-weight: 700;
  font-size: 1rem;
}

.progress-bar-track {
  background: var(--bg);
  border-radius: 99px;
  height: 6px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  background: var(--accent);
  border-radius: 99px;
  animation: progress-slide 1.8s ease-in-out infinite;
}

@keyframes progress-slide {
  0%   { left: -40%; }
  100% { left: 100%; }
}

.progress-label {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  animation: progress-fade 9s ease-in-out infinite;
}

@keyframes progress-fade {
  0%, 100% { opacity: 0.7; }
  33%      { opacity: 1; }
  66%      { opacity: 0.7; }
}

.label-paste {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-format {
  background: var(--accent2);
  color: var(--text);
  border: none;
  border-radius: var(--radius);
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  align-self: flex-start;
  margin-top: 0.25rem;
}

.btn-format:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lrc-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-lrc {
  background: rgba(245, 197, 24, 0.15);
  color: #f5c518;
  border: 1px solid rgba(245, 197, 24, 0.3);
  border-radius: var(--radius);
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-lrc:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-lrc-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
}

.lrc-meta { font-size: 0.75rem; color: #888; text-transform: none; letter-spacing: 0; width: 100%; margin-top: 0.2rem; }
.lrc-ok   { font-size: 0.8rem; color: #4caf50; text-transform: none; letter-spacing: 0; }
.lrc-warn { font-size: 0.8rem; color: #ff9800; text-transform: none; letter-spacing: 0; }
.lrc-err  { font-size: 0.8rem; color: #e94560; text-transform: none; letter-spacing: 0; }

.bpm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.bpm-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.btn-tap {
  background: var(--accent2);
  color: var(--text);
  border: none;
  border-radius: var(--radius);
  padding: 0.5rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.bpm-input {
  width: 5rem;
  text-align: center;
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.5rem;
  font-size: 1rem;
}

.yt-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.yt-input-row input {
  flex: 1;
}
</style>
