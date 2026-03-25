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
        <div class="format-row">
          <button type="button" class="btn-format" :disabled="!pasteText.trim()" @click="formatPaste">
            Format &amp; import
          </button>
          <span v-if="checking" class="check-status">AI checking...</span>
          <span v-if="checkError" class="check-error">{{ checkError }}</span>
        </div>
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
const checking = ref(false)
const checkError = ref('')

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
    if (!res.ok) return // silently keep formatter output on AI failure
    const data = await res.json()
    if (data.content) form.value.content = data.content
  } catch {
    checkError.value = 'AI check failed — using formatted output as-is'
  } finally {
    checking.value = false
  }
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

.format-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.check-status {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.check-error {
  font-size: 0.8rem;
  color: var(--accent);
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
