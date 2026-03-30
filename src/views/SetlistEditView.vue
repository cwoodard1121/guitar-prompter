<template>
  <div class="edit-view">
    <h1 class="page-title">{{ isNew ? 'New Setlist' : 'Edit Setlist' }}</h1>

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
            <button class="btn-icon" :disabled="idx === 0" @click="moveUp(idx)"><ChevronUp :size="14" /></button>
            <button class="btn-icon" :disabled="idx === setlistSongs.length - 1" @click="moveDown(idx)"><ChevronDown :size="14" /></button>
            <button class="btn-icon btn-remove" @click="removeSong(idx)"><X :size="14" /></button>
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
          <span class="btn-add-song"><Plus :size="14" /></span>
        </li>
        <li v-if="availableSongs.length === 0" class="empty-msg">All songs added</li>
      </ul>

      <div class="form-actions">
        <button class="btn-save" :disabled="!name.trim()" @click="save">Save Setlist</button>
        <RouterLink v-if="!isNew && songIds.length > 0" :to="`/song/${songIds[0]}/play?setlist=${route.params.id}&idx=0`" class="btn-play"><Play :size="15" /> Play</RouterLink>
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
import { ChevronUp, ChevronDown, X, Plus, Play } from 'lucide-vue-next'

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
  gap: 1.1rem;
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
  gap: 0.45rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  font-weight: 600;
}
input {
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.75rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
  outline: none;
}

.section-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: var(--text-muted);
  padding-bottom: 0.45rem;
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
  gap: 0.45rem;
}
.setlist-song-row, .library-row {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: var(--shadow-sm);
}
.library-row { cursor: pointer; transition: border-color 0.15s; }
.library-row:active { opacity: 0.75; transform: scale(0.99); }

.song-pos {
  font-size: 0.83rem;
  color: var(--text-muted);
  min-width: 1.2rem;
  text-align: center;
  font-weight: 600;
}
.song-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.song-title {
  font-size: 0.97rem;
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
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.88rem;
  padding: 0.4rem 0.6rem;
  min-width: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.btn-icon:disabled { opacity: 0.2; }
.btn-icon:active:not(:disabled) { background: rgba(255,255,255,0.12); color: var(--text); }
.btn-remove {
  color: var(--accent);
  background: rgba(232,54,93,0.08);
  border-color: rgba(232,54,93,0.18);
}

.btn-add-song {
  background: rgba(232,54,93,0.1);
  color: var(--accent);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.6rem;
  flex-shrink: 0;
  border: 1px solid rgba(232,54,93,0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  padding: 0.9rem;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 3px 12px var(--accent-glow);
  letter-spacing: 0.01em;
}
.btn-save:disabled { opacity: 0.4; box-shadow: none; }
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
.btn-delete {
  background: none;
  border: 1px solid rgba(232,54,93,0.2);
  border-radius: var(--radius);
  color: var(--accent);
  padding: 0.65rem;
  font-size: 0.85rem;
  width: 100%;
  margin-bottom: 1rem;
  opacity: 0.7;
  transition: opacity 0.15s, border-color 0.15s;
}
.btn-delete:active { opacity: 1; }
</style>
