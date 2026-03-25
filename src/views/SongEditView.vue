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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import ChordChart from '../components/ChordChart.vue'
import { parseTabText } from '../utils/parseTab.js'

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const isNew = computed(() => route.params.id === undefined)

const form = ref({ title: '', artist: '', content: '' })
const pasteText = ref('')
const loadingLyrics = ref(false)
const chordError = ref('')
const loadingPhase = ref('')

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
    if (song) form.value = { title: song.title, artist: song.artist, content: song.content }
    else router.replace('/')
  }
})

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
</style>
