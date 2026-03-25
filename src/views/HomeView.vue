<template>
  <div class="home">
    <header class="home-header">
      <h1>🎸 Guitar Prompter</h1>
      <RouterLink to="/song/new" class="btn-add">+ New Song</RouterLink>
    </header>

    <div v-if="store.songs.length === 0" class="empty">
      <p>No songs yet. Tap <strong>+ New Song</strong> to get started.</p>
    </div>

    <ul v-else class="song-list">
      <li v-for="song in store.songs" :key="song.id" class="song-card">
        <div class="song-info">
          <span class="song-title">{{ song.title }}</span>
          <span class="song-artist">{{ song.artist }}</span>
        </div>
        <div class="song-actions">
          <RouterLink :to="`/song/${song.id}/play`" class="btn btn-play">▶ Play</RouterLink>
          <RouterLink :to="`/song/${song.id}/edit`" class="btn btn-edit">✏️</RouterLink>
          <button class="btn btn-delete" @click="confirmDelete(song)">🗑️</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'

const store = useSongsStore()

async function confirmDelete(song) {
  if (confirm(`Delete "${song.title}"?`)) {
    await store.deleteSong(song.id)
  }
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 1rem;
  gap: 1rem;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.home-header h1 {
  font-size: 1.4rem;
  color: var(--text);
}

.btn-add {
  background: var(--accent);
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 0.95rem;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.8;
}

.song-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.song-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.song-title {
  font-size: 1.1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.song-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.5rem 0.9rem;
  border-radius: var(--radius);
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  background: var(--accent2);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.btn-play {
  background: var(--accent);
  color: #fff;
}

.btn-delete {
  background: #3a1a1a;
}
</style>
