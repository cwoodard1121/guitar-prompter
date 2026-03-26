<template>
  <div class="edit-view">
    <header class="edit-header">
      <button class="btn-back" @click="router.back()">← Back</button>
      <h2>{{ isNew ? 'New Setlist' : 'Edit Setlist' }}</h2>
    </header>

    <div class="edit-form">
      <label>
        Name
        <input v-model="name" type="text" placeholder="Friday Night Set" />
      </label>

      <!-- Songs in setlist -->
      <div class="section-label">Songs in setlist</div>
      <div v-if="setlistSongs.length === 0" class="empty-msg">No songs yet — add from your library below</div>
      <ul v-else class="setlist-songs">
        <li v-for="(song, idx) in setlistSongs" :key="song.id + idx" class="setlist-song-row">
          <div class="song-pos">{{ idx + 1 }}</div>
          <div class="song-info">
            <span class="song-title">{{ song.title }}</span>
            <span class="song-artist">{{ song.artist }}</span>
          </div>
          <div class="row-actions">
            <button class="btn-icon" :disabled="idx === 0" @click="moveUp(idx)">↑</button>
            <button class="btn-icon" :disabled="idx === setlistSongs.length - 1" @click="moveDown(idx)">↓</button>
            <button class="btn-icon btn-remove" @click="removeSong(idx)">✕</button>
          </div>
        </li>
      </ul>

      <!-- Library picker -->
      <div class="section-label">Add from library</div>
      <ul class="library-list">
        <li v-for="song in availableSongs" :key="song.id" class="library-row" @click="addSong(song)">
          <div class="song-info">
            <span class="song-title">{{ song.title }}</span>
            <span class="song-artist">{{ song.artist }}</span>
          </div>
          <span class="btn-add-song">+</span>
        </li>
        <li v-if="availableSongs.length === 0" class="empty-msg">All songs added</li>
      </ul>

      <div class="form-actions">
        <button class="btn-save" :disabled="!name.trim()" @click="save">Save Setlist</button>
        <RouterLink v-if="!isNew" :to="`/setlist/${route.params.id}/play`" class="btn-play">▶ Play</RouterLink>
      </div>

      <button v-if="!isNew" class="btn-delete" @click="deleteSetlist">Delete setlist</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import { useSetlistsStore } from '../stores/setlists.js'

const route = useRoute()
const router = useRouter()
const songsStore = useSongsStore()
const setlistsStore = useSetlistsStore()

const isNew = computed(() => route.params.id === undefined)
const name = ref('')
const songIds = ref([])   // ordered array of song ids

const setlistSongs = computed(() =>
  songIds.value.map(id => songsStore.songs.find(s => s.id === id)).filter(Boolean)
)

const availableSongs = computed(() =>
  songsStore.songs.filter(s => !songIds.value.includes(s.id))
)

onMounted(() => {
  if (!isNew.value) {
    const setlist = setlistsStore.getSetlist(route.params.id)
    if (setlist) {
      name.value = setlist.name
      songIds.value = [...(setlist.songIds ?? [])]
    } else {
      router.replace('/')
    }
  }
})

function addSong(song) {
  songIds.value.push(song.id)
}

function removeSong(idx) {
  songIds.value.splice(idx, 1)
}

function moveUp(idx) {
  if (idx === 0) return
  const ids = [...songIds.value]
  ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
  songIds.value = ids
}

function moveDown(idx) {
  if (idx === songIds.value.length - 1) return
  const ids = [...songIds.value]
  ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
  songIds.value = ids
}

async function save() {
  if (!name.value.trim()) return
  const payload = { name: name.value.trim(), songIds: songIds.value }
  if (isNew.value) {
    const created = await setlistsStore.addSetlist(payload)
    router.replace(`/setlist/${created.id}/edit`)
  } else {
    await setlistsStore.updateSetlist(route.params.id, payload)
    router.push('/')
  }
}

async function deleteSetlist() {
  if (confirm(`Delete "${name.value}"?`)) {
    await setlistsStore.deleteSetlist(route.params.id)
    router.push('/')
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
input {
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.75rem;
  font-size: 1rem;
  outline: none;
}
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(233,69,96,0.15);
  outline: none;
}

.section-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--text-muted);
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border-subtle);
}

.empty-msg {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 0.5rem 0;
}

/* Setlist song rows */
.setlist-songs, .library-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.setlist-song-row, .library-row {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.library-row { cursor: pointer; }
.library-row:active { opacity: 0.7; transform: scale(0.99); }

.song-pos {
  font-size: 0.85rem;
  color: var(--text-muted);
  min-width: 1.2rem;
  text-align: center;
}
.song-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.song-title {
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-artist {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.row-actions {
  display: flex;
  gap: 0.3rem;
}
.btn-icon {
  background: rgba(255,255,255,0.08);
  border: none;
  border-radius: 6px;
  color: var(--text);
  font-size: 0.9rem;
  padding: 0.4rem 0.6rem;
  min-width: 2rem;
  text-align: center;
}
.btn-icon:disabled { opacity: 0.2; }
.btn-icon:active:not(:disabled) { opacity: 0.6; }
.btn-remove { color: #e94560; background: rgba(233,69,96,0.1); }

.btn-add-song {
  font-size: 0.85rem;
  font-weight: 700;
  background: rgba(233,69,96,0.12);
  color: var(--accent);
  border-radius: 6px;
  padding: 0.3rem 0.65rem;
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
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
.btn-save:disabled { opacity: 0.4; }
.btn-play {
  background: var(--accent2);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.85rem 1.2rem;
  font-weight: 700;
  font-size: 1rem;
}
.btn-delete {
  background: none;
  border: 1px solid #3a1a1a;
  border-radius: var(--radius);
  color: #e94560;
  padding: 0.6rem;
  font-size: 0.85rem;
  width: 100%;
  margin-bottom: 1rem;
}
</style>
