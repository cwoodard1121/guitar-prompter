<template>
  <div>
    <!-- Server wake-up overlay -->
    <div v-if="serverStatus !== 'online'" class="wake-overlay">
      <div class="wake-card">
        <div class="wake-icon">🎸</div>
        <div v-if="serverStatus === 'checking'" class="wake-title">Loading…</div>
        <div v-else class="wake-title">Server is starting up</div>
        <div v-if="serverStatus === 'checking'" class="wake-sub">Connecting to server…</div>
        <div v-else class="wake-sub">
          Render free tier spins down when idle.<br>This usually takes ~30 seconds.
        </div>
        <div class="wake-spinner">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
        <div v-if="elapsed > 0" class="wake-elapsed">{{ elapsed }}s elapsed</div>
        <button class="wake-retry" @click="checkHealth">Retry now</button>
      </div>
    </div>

    <template v-if="serverStatus === 'online'">
      <AppLayout v-if="!isPlayRoute">
        <RouterView />
      </AppLayout>
      <RouterView v-else />
    </template>
  </div>
</template>

<script setup>
import { RouterView, useRoute } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSongsStore } from './stores/songs.js'
import AppLayout from './components/AppLayout.vue'

const store = useSongsStore()
const route = useRoute()
const isPlayRoute = computed(() => route.path.endsWith('/play'))

const serverStatus = ref('checking') // 'checking' | 'waking' | 'online'
const elapsed = ref(0)

let retryTimer = null
let elapsedTimer = null
let startTime = null

async function checkHealth() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch('/api/health', { signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
      clearTimers()
      serverStatus.value = 'online'
      store.loadSongs()
      return
    }
  } catch {
    // fetch failed or timed out — server still waking
  }

  if (serverStatus.value === 'checking') {
    serverStatus.value = 'waking'
    startTime = Date.now()
    elapsedTimer = setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startTime) / 1000)
    }, 1000)
  }

  retryTimer = setTimeout(checkHealth, 5000)
}

function clearTimers() {
  if (retryTimer) clearTimeout(retryTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
}

onMounted(checkHealth)
onUnmounted(clearTimers)
</script>

<style scoped>
.wake-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg, #1a1a2e);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.wake-card {
  background: var(--bg-card, #16213e);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  width: min(340px, 90vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.wake-icon {
  font-size: 2.2rem;
  background: #e94560;
  border-radius: 12px;
  width: 3.2rem;
  height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.wake-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #eaeaea;
}

.wake-sub {
  font-size: 0.82rem;
  color: #888;
  line-height: 1.6;
}

.wake-spinner {
  display: flex;
  gap: 0.4rem;
  margin: 0.25rem 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e94560;
  animation: bounce 1.2s ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%            { transform: scale(1);   opacity: 1; }
}

.wake-elapsed {
  font-size: 0.78rem;
  color: #666;
}

.wake-retry {
  margin-top: 0.25rem;
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #888;
  font-size: 0.82rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
}
.wake-retry:active { opacity: 0.7; }
</style>
