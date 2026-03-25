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

      <label class="label-content">
        Chords &amp; Lyrics
        <span class="hint">Put chord names in [brackets] above the words they fall on</span>
        <textarea
          v-model="form.content"
          placeholder="[G]Here comes the [C]sun..."
          rows="16"
          spellcheck="false"
        ></textarea>
      </label>

      <div class="chord-suggest" v-if="isNew">
        <div class="provider-toggle">
          <button
            type="button"
            class="provider-btn"
            :class="{ active: provider === 'anthropic' }"
            @click="provider = 'anthropic'"
          >Claude</button>
          <button
            type="button"
            class="provider-btn"
            :class="{ active: provider === 'openai' }"
            @click="provider = 'openai'"
          >ChatGPT</button>
        </div>
        <button type="button" class="btn-suggest" :disabled="loadingChords || !form.title" @click="suggestChords">
          {{ loadingChords ? 'Loading…' : '✨ Suggest chords with AI' }}
        </button>
        <span v-if="chordError" class="chord-error">{{ chordError }}</span>
      </div>

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

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const isNew = computed(() => route.params.id === undefined)

const form = ref({ title: '', artist: '', content: '' })
const loadingChords = ref(false)
const chordError = ref('')
const provider = ref('anthropic')

onMounted(() => {
  if (!isNew.value) {
    const song = store.getSong(route.params.id)
    if (song) form.value = { title: song.title, artist: song.artist, content: song.content }
    else router.replace('/')
  }
})

function save() {
  if (isNew.value) {
    store.addSong(form.value)
  } else {
    store.updateSong(route.params.id, form.value)
  }
  router.push('/')
}

async function suggestChords() {
  loadingChords.value = true
  chordError.value = ''
  try {
    const res = await fetch(`/api/chords?title=${encodeURIComponent(form.value.title)}&artist=${encodeURIComponent(form.value.artist)}&provider=${provider.value}`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    if (data.content) form.value.content = data.content
  } catch (e) {
    chordError.value = e.message || 'Could not fetch chord suggestions.'
  } finally {
    loadingChords.value = false
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
  gap: 1rem;
  flex-wrap: wrap;
}

.provider-toggle {
  display: flex;
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  overflow: hidden;
}

.provider-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.provider-btn.active {
  background: var(--accent2);
  color: var(--text);
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
</style>
