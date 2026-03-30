<template>
  <div class="community-view">
    <h1 class="page-title">Community</h1>

    <!-- Search bar -->
    <div class="search-bar">
      <Search :size="16" class="search-icon" />
      <input
        v-model="q"
        type="text"
        placeholder="Search songs or artists…"
        class="search-input"
        @input="onSearch"
      />
    </div>

    <!-- Error state -->
    <div v-if="store.error" class="empty-state">
      <p>{{ store.error }}</p>
      <button class="btn-load-more" @click="store.load(q)">Retry</button>
    </div>

    <!-- Loading skeletons (initial load) -->
    <div v-else-if="store.loading && store.songs.length === 0" class="community-grid">
      <div v-for="n in 12" :key="n" class="song-card song-card-skeleton">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-artist"></div>
        <div class="skeleton-line skeleton-contributor"></div>
        <div class="skeleton-actions"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.loading && store.songs.length === 0" class="empty-state">
      <p class="empty-title">No public songs yet.</p>
      <p class="empty-desc">Be the first to share one!</p>
    </div>

    <!-- Song grid -->
    <div v-else class="community-grid">
      <div
        v-for="song in store.songs"
        :key="song.id"
        class="song-card"
      >
        <div class="song-title">{{ song.title || 'Untitled' }}</div>
        <div class="song-artist">{{ song.artist || 'Unknown Artist' }}</div>
        <div class="song-contributor">Shared by @{{ song.contributor }}</div>

        <div class="card-actions">
          <button
            class="btn-like"
            :class="{ liked: song.liked }"
            @click="store.toggleLike(song.id)"
            :title="song.liked ? 'Unlike' : 'Like'"
          >
            <Heart :size="13" :fill="song.liked ? 'currentColor' : 'none'" />
            {{ song.likesCount }}
          </button>

          <button
            class="btn-copy"
            @click="handleCopy(song)"
            :disabled="copied === song.id"
          >
            <template v-if="copied === song.id">
              <Check :size="13" />
              Added!
            </template>
            <template v-else>
              <BookPlus :size="13" />
              Add to Library
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="store.songs.length > 0 && store.songs.length < store.total" class="load-more-row">
      <button
        class="btn-load-more"
        :disabled="store.loading"
        @click="loadMore"
      >
        {{ store.loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Heart, BookPlus, Search, Check } from 'lucide-vue-next'
import { useCommunityStore } from '../stores/community.js'

const store = useCommunityStore()
const q = ref('')
const copied = ref(null)
let debounceTimer = null

function onSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => store.load(q.value), 300)
}

function loadMore() {
  store.load(q.value, store.page + 1)
}

async function handleCopy(song) {
  try {
    await store.copyToLibrary(song)
    copied.value = song.id
    setTimeout(() => { copied.value = null }, 2000)
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => store.load())
</script>

<style scoped>
.community-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Search */
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--text-muted);
  pointer-events: none;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 0.7rem 0.75rem 0.7rem 2.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

/* Grid */
.community-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

/* Song card */
.song-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: background 0.15s;
}

.song-card:hover {
  background: var(--bg-card-hover);
}

.song-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  color: var(--text-muted);
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-contributor {
  font-size: 0.75rem;
  color: var(--text-muted);
  opacity: 0.7;
}

/* Card actions */
.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.btn-like {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border-radius: var(--radius-sm);
  background: none;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-like:hover {
  border-color: rgba(232, 54, 93, 0.3);
  color: #e8365d;
}

.btn-like.liked {
  color: #e8365d;
  border-color: rgba(232, 54, 93, 0.3);
  background: rgba(232, 54, 93, 0.08);
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border-radius: var(--radius-sm);
  background: rgba(124, 111, 255, 0.08);
  border: 1px solid rgba(124, 111, 255, 0.2);
  color: var(--accent2-bright);
  font-size: 0.8rem;
  cursor: pointer;
  flex: 1;
  justify-content: center;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-copy:hover {
  background: rgba(124, 111, 255, 0.14);
}

.btn-copy:disabled {
  opacity: 0.75;
  cursor: default;
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.2);
  color: #5dbf61;
}

/* Skeleton loading */
.song-card-skeleton {
  pointer-events: none;
}

.skeleton-line {
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-xs);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-title {
  height: 0.95rem;
  width: 75%;
}

.skeleton-artist {
  height: 0.8rem;
  width: 55%;
}

.skeleton-contributor {
  height: 0.72rem;
  width: 65%;
}

.skeleton-actions {
  height: 2rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  margin-top: auto;
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.empty-desc {
  font-size: 0.88rem;
  color: var(--text-muted);
}

/* Load more */
.load-more-row {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0 1.5rem;
}

.btn-load-more {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0.65rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-load-more:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.btn-load-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .community-grid {
    grid-template-columns: 1fr;
  }
}
</style>
