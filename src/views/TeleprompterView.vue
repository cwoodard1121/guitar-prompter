<template>
  <div class="tp-root" :style="{ fontSize: fontSize + 'px' }">

    <!-- Tap zones (invisible, full height) — hidden when chord diagrams showing -->
    <div class="tap-zone tap-left" :class="{ disabled: showChordDiagrams }" @click="scrollBack"></div>
    <div class="tap-zone tap-right" :class="{ disabled: showChordDiagrams }" @click="scrollForward"></div>

    <!-- Song content -->
    <div ref="contentEl" class="tp-content">
      <div class="tp-song-header">
        <span class="tp-title">{{ song?.title }}</span>
        <span class="tp-artist">{{ song?.artist }}</span>
      </div>

      <!-- Chord diagrams panel -->
      <div v-if="showChordDiagrams" class="tp-chord-diagrams">
        <div class="tp-capo-row">
          <button class="tp-capo-btn" :class="{ active: capoFret === 0 }" @click="capoFret = 0">No Capo</button>
          <button class="tp-capo-btn" :class="{ active: capoFret === 1 }" @click="capoFret = capoFret === 1 ? 0 : 1">Capo 1</button>
          <button class="tp-capo-btn" :class="{ active: capoFret === 2 }" @click="capoFret = capoFret === 2 ? 0 : 2">Capo 2</button>
          <button class="tp-capo-btn" :class="{ active: capoFret === 3 }" @click="capoFret = capoFret === 3 ? 0 : 3">Capo 3</button>
          <button class="tp-capo-btn" :class="{ active: capoFret === 4 }" @click="capoFret = capoFret === 4 ? 0 : 4">Capo 4</button>
        </div>
        <div class="tp-diagram-grid">
          <div v-for="chord in displayChords" :key="chord.displayName" class="tp-diagram-item">
            <div class="tp-diagram-wrap">
              <ChordDiagram
                v-if="chord.data"
                :name="chord.shapeName"
                :chord="chord.data"
                :tuning="['E', 'A', 'D', 'G', 'B', 'E']"
              />
              <div v-else class="tp-diagram-unknown">
                <div class="tp-diagram-box">?</div>
                <div class="tp-diagram-name">{{ chord.shapeName }}</div>
              </div>
              <div v-if="capoFret > 0" class="tp-sounds-as">{{ chord.displayName }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tp-lines">
        <template v-for="(line, i) in parsedLines" :key="i">
          <div
            v-if="line.type === 'chord-lyric'"
            class="tp-chord-lyric-row"
            :class="{
              'tp-line-active': syncMode && i === currentSyncLine,
              'tp-line-next':   syncMode && i === nextSyncLine,
              'tp-line-tappable': syncMode && lineTimings[i] !== null
            }"
            :ref="el => { if (el) lineRefs[i] = el }"
            @click.stop="syncMode && lineTimings[i] !== null && seekToLineByIndex(i)"
          >
            <span v-for="(seg, j) in line.segments" :key="j" class="tp-segment">
              <span class="tp-chord-above" :class="{ 'tp-chord-transition': seg.isTransition }">{{ seg.chord ?? '' }}</span>
              <span class="tp-lyric-below">{{ seg.lyric }}</span>
            </span>
          </div>
          <div
            v-else-if="line.type === 'chord-only'"
            class="tp-chord-only-row"
            :ref="el => { if (el) lineRefs[i] = el }"
          >
            <span v-for="(chord, j) in line.chords" :key="j" class="tp-chord-solo">{{ chord }}</span>
          </div>
          <div
            v-else-if="line.type === 'lyric'"
            class="tp-lyric-row"
            :class="{
              'tp-line-active': syncMode && i === currentSyncLine,
              'tp-line-next':   syncMode && i === nextSyncLine,
              'tp-line-tappable': syncMode && lineTimings[i] !== null
            }"
            :ref="el => { if (el) lineRefs[i] = el }"
            @click.stop="syncMode && lineTimings[i] !== null && seekToLineByIndex(i)"
          >{{ line.text }}</div>
          <div v-else class="tp-blank"></div>
        </template>
      </div>
    </div>

    <!-- YouTube embed overlay -->
    <div v-if="hasYoutube && syncEnabled" class="yt-overlay" :class="{ 'yt-hidden': !showYT }">
      <div class="yt-header">
        <span class="yt-label">▶ YouTube</span>
        <button class="yt-toggle-btn" @click="showYT = !showYT">{{ showYT ? '▾' : '▸' }}</button>
      </div>
      <div ref="ytPlayerEl" class="yt-player-el"></div>
    </div>

    <!-- Controls overlay (top) -->
    <div class="tp-controls" :class="{ hidden: controlsHidden }">
      <button class="ctrl-btn" @click="goHome">✕</button>
      <div class="ctrl-group">
        <button class="ctrl-btn" @click="fontSize = Math.max(14, fontSize - 2)">A−</button>
        <button class="ctrl-btn" @click="fontSize = Math.min(60, fontSize + 2)">A+</button>
      </div>
      <div v-if="!syncMode" class="ctrl-group">
        <button class="ctrl-btn" @click="speed = Math.max(5, speed - 5)">🐢</button>
        <button class="ctrl-btn speed-val">{{ speed }}</button>
        <button class="ctrl-btn" @click="speed = Math.min(200, speed + 5)">🐇</button>
      </div>
      <button class="ctrl-btn chord-toggle-btn" :class="{ active: showChordDiagrams }" @click="showChordDiagrams = !showChordDiagrams">
        🎸
      </button>
      <button v-if="hasSync" class="ctrl-btn sync-toggle-btn" :class="{ active: syncEnabled }" @click="toggleSync">
        ⏱
      </button>
      <template v-if="syncMode">
        <button class="ctrl-btn nudge-btn" @click="syncOffset -= 0.5" title="Lyrics ahead — shift back">−½s</button>
        <button class="ctrl-btn nudge-btn" @click="syncOffset += 0.5" title="Lyrics behind — shift forward">+½s</button>
      </template>
      <button v-if="!syncMode" class="ctrl-btn catchup-btn" @click="catchUp">
        ⏩
      </button>
      <button class="ctrl-btn play-btn" @click="toggleScroll">
        {{ scrolling ? '⏸' : '▶' }}
      </button>
    </div>

    <!-- Tap to show controls hint -->
    <div class="ctrl-toggle" @click="controlsHidden = !controlsHidden">
      <span>{{ controlsHidden ? '☰' : '▲' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import ChordDiagram from '../components/ChordDiagram.vue'
import { extractChordNames, getChord, transposeChord } from '../data/chords.js'
import { parseLrc, matchLrcToLines } from '../utils/parseLrc.js'

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const song = computed(() => store.getSong(route.params.id))
const contentEl = ref(null)
const fontSize = ref(24)
const speed = ref(40)
const scrolling = ref(false)
const controlsHidden = ref(false)
const showChordDiagrams = ref(false)
const capoFret = ref(0)

// --- Sync mode ---
const syncEnabled = ref(false)
const playStartTime = ref(null)
const elapsed = ref(0)
const syncOffset = ref(0)   // seconds — positive = lyrics shift earlier, negative = later
const lineRefs = ref([])

// --- YouTube ---
const ytPlayerEl = ref(null)
const ytReady = ref(false)
const showYT = ref(true)
let ytPlayer = null

const hasYoutube = computed(() => !!song.value?.youtubeId)

async function loadYouTubeApi() {
  if (window.YT?.Player) return
  await new Promise(resolve => {
    if (document.getElementById('yt-api-script')) {
      const check = setInterval(() => { if (window.YT?.Player) { clearInterval(check); resolve() } }, 100)
      return
    }
    const tag = document.createElement('script')
    tag.id = 'yt-api-script'
    tag.src = 'https://www.youtube.com/iframe_api'
    window.onYouTubeIframeAPIReady = resolve
    document.head.appendChild(tag)
  })
}

async function initYTPlayer(videoId) {
  await loadYouTubeApi()
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; ytReady.value = false }
  await nextTick()
  if (!ytPlayerEl.value) return
  ytPlayer = new window.YT.Player(ytPlayerEl.value, {
    videoId,
    playerVars: { rel: 0, modestbranding: 1 },
    events: {
      onReady: () => { ytReady.value = true },
      onStateChange: (e) => {
        const S = window.YT.PlayerState
        if (e.data === S.PAUSED && scrolling.value) scrolling.value = false
        if (e.data === S.PLAYING && !scrolling.value) scrolling.value = true
      }
    }
  })
}

watch(syncEnabled, async (enabled) => {
  if (enabled && song.value?.youtubeId) {
    await nextTick()
    initYTPlayer(song.value.youtubeId)
  } else if (!enabled && ytPlayer) {
    ytPlayer.destroy(); ytPlayer = null; ytReady.value = false
  }
})

// --- Chord display ---
const chordNames = computed(() => {
  if (!song.value?.content) return []
  return extractChordNames(song.value.content)
})

const displayChords = computed(() => {
  return chordNames.value.map(name => {
    const shapeName = capoFret.value > 0 ? transposeChord(name, -capoFret.value) : name
    return { displayName: name, shapeName, data: getChord(shapeName) }
  })
})

let rafId = null
let lastTime = null

// --- Parsed lines ---
const parsedLines = computed(() => {
  if (!song.value?.content) return []
  const lines = song.value.content.split('\n')
  const result = []
  const isChordLine = (s) => /^\s*(\[[\w#b/]+\]\s*)+$/.test(s)
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    if (!raw.trim()) { result.push({ type: 'blank' }); i++; continue }

    if (isChordLine(raw)) {
      const chords = []
      const re = /\[([^\]]+)\]/g
      let m
      while ((m = re.exec(raw)) !== null) chords.push({ chord: m[1], col: m.index })

      const next = lines[i + 1]
      if (next !== undefined && next.trim() && !isChordLine(next)) {
        const lyric = next.replace(/\[[\w#b/]+\]/g, '')
        const segments = []
        if (chords.length > 0 && chords[0].col > 0)
          segments.push({ chord: null, lyric: lyric.slice(0, chords[0].col), isTransition: false })
        for (let k = 0; k < chords.length; k++) {
          const start = chords[k].col
          const end = k < chords.length - 1 ? chords[k + 1].col : lyric.length
          segments.push({ chord: chords[k].chord, lyric: lyric.slice(start, end), isTransition: k === chords.length - 1 })
        }
        result.push({ type: 'chord-lyric', segments })
        i += 2
      } else {
        result.push({ type: 'chord-only', chords: chords.map(c => c.chord) })
        i++
      }
      continue
    }

    const lyric = raw.replace(/\[[\w#b/]+\]/g, '').trimEnd()
    result.push({ type: 'lyric', text: lyric || raw })
    i++
  }
  return result
})

watch(parsedLines, () => { lineRefs.value = [] })

// --- LRC / Sync ---
const lrcLines = computed(() =>
  song.value?.syncedLyrics ? parseLrc(song.value.syncedLyrics) : []
)
const lineTimings = computed(() =>
  lrcLines.value.length ? matchLrcToLines(lrcLines.value, parsedLines.value) : []
)
const hasSync = computed(() => lineTimings.value.some(t => t !== null))
const syncMode = computed(() => hasSync.value && syncEnabled.value)

const currentSyncLine = computed(() => {
  if (!syncMode.value) return -1
  let best = -1
  for (let i = 0; i < lineTimings.value.length; i++) {
    const t = lineTimings.value[i]
    if (t !== null && t <= elapsed.value) best = i
  }
  return best
})

// Next timed line after current (for lookahead highlight)
const nextSyncLine = computed(() => {
  if (currentSyncLine.value < 0) return -1
  for (let i = currentSyncLine.value + 1; i < lineTimings.value.length; i++) {
    if (lineTimings.value[i] !== null) return i
  }
  return -1
})

// Auto-scroll only when active line is outside the visible reading area
watch(currentSyncLine, (i) => { if (i >= 0) scrollToLineIfNeeded(i) })

function scrollToLineIfNeeded(i) {
  const el = lineRefs.value[i]
  if (!el || !contentEl.value) return
  const containerRect = contentEl.value.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const topBound = containerRect.top + containerRect.height * 0.15
  const bottomBound = containerRect.top + containerRect.height * 0.75
  if (elRect.top < topBound || elRect.bottom > bottomBound) {
    const target = el.offsetTop - contentEl.value.clientHeight * 0.35
    contentEl.value.scrollTop = Math.max(0, target)
  }
}

let syncRafId = null

// Sync tick — always runs while syncMode is on, regardless of play/pause
// YouTube drives elapsed directly; wall-clock only advances when scrolling
function startSyncTick() {
  if (syncRafId) return
  function tick(now) {
    if (!syncMode.value) { syncRafId = null; return }
    if (ytPlayer && ytReady.value) {
      // YouTube is the clock — reflect seeks instantly
      elapsed.value = ytPlayer.getCurrentTime() + syncOffset.value
    } else if (scrolling.value && playStartTime.value !== null) {
      // No YouTube — advance by wall clock only while playing
      elapsed.value = (now - playStartTime.value) / 1000 + syncOffset.value
    }
    syncRafId = requestAnimationFrame(tick)
  }
  syncRafId = requestAnimationFrame(tick)
}

function stopSyncTick() {
  if (syncRafId) { cancelAnimationFrame(syncRafId); syncRafId = null }
}

watch(syncMode, (active) => {
  if (active) startSyncTick()
  else stopSyncTick()
})

// Manual scroll tick (non-sync mode)
function tick(ts) {
  if (!scrolling.value) return
  if (lastTime !== null) contentEl.value.scrollTop += speed.value * (ts - lastTime) / 1000
  lastTime = ts
  rafId = requestAnimationFrame(tick)
}

watch(scrolling, (val) => {
  if (syncMode.value) {
    // In sync mode, scrolling only controls YouTube play/pause — tick runs independently
    if (!val) { playStartTime.value = null }
    return
  }
  // Manual scroll mode
  if (val) {
    lastTime = null
    rafId = requestAnimationFrame(tick)
  } else {
    if (rafId) cancelAnimationFrame(rafId)
    lastTime = null
  }
})

function toggleScroll() {
  if (ytPlayer && ytReady.value && syncMode.value) {
    if (scrolling.value) {
      ytPlayer.pauseVideo()
    } else {
      if (playStartTime.value === null) playStartTime.value = performance.now()
      ytPlayer.playVideo()
    }
  } else if (syncMode.value) {
    // Sync mode without YouTube
    if (!scrolling.value) playStartTime.value = performance.now() - elapsed.value * 1000
    scrolling.value = !scrolling.value
  } else {
    scrolling.value = !scrolling.value
  }
}

function toggleSync() {
  if (scrolling.value) {
    if (ytPlayer && ytReady.value) ytPlayer.pauseVideo()
    scrolling.value = false
  }
  syncEnabled.value = !syncEnabled.value
  playStartTime.value = null
  elapsed.value = 0
  syncOffset.value = 0
}

const CATCHUP_JUMP = 800
const PAGE_JUMP = 300

function catchUp() {
  contentEl.value.scrollBy({ top: CATCHUP_JUMP, behavior: 'smooth' })
}

function seekLine(delta) {
  const timings = lineTimings.value
  let target = currentSyncLine.value + delta
  while (target >= 0 && target < timings.length && timings[target] === null) target += delta
  if (target < 0 || target >= timings.length) return
  seekToLineByIndex(target)
}

function seekToLineByIndex(i) {
  const targetTime = lineTimings.value[i]
  if (targetTime === null || targetTime === undefined) return
  if (ytPlayer && ytReady.value) {
    ytPlayer.seekTo(targetTime, true)
  } else {
    playStartTime.value = performance.now() - targetTime * 1000
    elapsed.value = targetTime
  }
}

function scrollForward() {
  if (syncMode.value && scrolling.value) seekLine(1)
  else contentEl.value.scrollBy({ top: PAGE_JUMP, behavior: 'smooth' })
}

function scrollBack() {
  if (syncMode.value && scrolling.value) seekLine(-1)
  else contentEl.value.scrollBy({ top: -PAGE_JUMP, behavior: 'smooth' })
}

function goHome() {
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null }
  scrolling.value = false
  router.push('/')
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  stopSyncTick()
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null }
})
</script>

<style scoped>
.tp-root {
  position: fixed;
  inset: 0;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tap-zone {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 30%;
  z-index: 10;
}
.tap-zone.disabled {
  pointer-events: none;
}
.tap-left  { left: 0; }
.tap-right { right: 0; }

.tp-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5rem 1.5rem 6rem;
  scroll-behavior: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tp-content::-webkit-scrollbar { display: none; }

.tp-song-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5em;
  gap: 0.2em;
}

.tp-title {
  font-size: 1.2em;
  font-weight: 700;
  color: #fff;
}

.tp-artist {
  font-size: 0.85em;
  color: #aaa;
}

.tp-chord-diagrams {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5em;
}

.tp-capo-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.tp-capo-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-size: 0.7em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tp-capo-btn.active {
  background: var(--chord, #f5c518);
  color: #000;
  border-color: var(--chord, #f5c518);
}

.tp-diagram-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.tp-diagram-item { flex: 0 0 auto; }

.tp-diagram-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tp-sounds-as {
  font-size: 0.65em;
  color: #888;
  margin-top: -0.1em;
}

.tp-diagram-unknown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.tp-diagram-box {
  width: 80px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #666;
  font-size: 1.5em;
}

.tp-diagram-name {
  font-weight: 700;
  font-size: 0.8em;
  color: #888;
}

.tp-lines {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
}

.tp-chord-lyric-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 0.4em;
  gap: 0 0.3ch;
}

.tp-segment {
  display: inline-flex;
  flex-direction: column;
  white-space: pre;
  padding-right: 0.4ch;
}

.tp-chord-above {
  color: var(--chord, #f5c518);
  font-weight: 700;
  font-family: 'Courier New', monospace;
  line-height: 1.4;
  min-height: 1.4em;
  letter-spacing: 0.02em;
}

.tp-chord-above.tp-chord-transition {
  opacity: 0.4;
}

.tp-lyric-below {
  color: #fff;
  font-family: 'Courier New', monospace;
  line-height: 1.6;
  transition: color 0.35s ease;
}

.tp-chord-only-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2ch;
  color: var(--chord, #f5c518);
  font-weight: 700;
  font-family: 'Courier New', monospace;
  margin-bottom: 0.5em;
}

.tp-chord-solo {
  white-space: pre;
}

.tp-lyric-row {
  line-height: 1.6;
  padding-bottom: 0.25em;
  color: #fff;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  transition: color 0.35s ease;
}

.tp-blank { height: 1.2em; }

.tp-controls {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  transition: transform 0.25s ease;
}

.tp-controls.hidden { transform: translateY(-110%); }

.ctrl-btn {
  background: rgba(255,255,255,0.12);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 1.1rem;
  padding: 0.5rem 0.8rem;
  min-width: 2.5rem;
  text-align: center;
}

.chord-toggle-btn.active {
  background: var(--chord, #f5c518);
  color: #000;
}

.catchup-btn {
  background: rgba(255, 200, 0, 0.2);
  font-size: 1.1rem;
}

.catchup-btn:active {
  background: rgba(255, 200, 0, 0.5);
}

.speed-val {
  min-width: 2.8rem;
  font-size: 0.9rem;
  pointer-events: none;
}

.play-btn {
  margin-left: auto;
  background: var(--accent, #e94560);
  font-size: 1.3rem;
  padding: 0.5rem 1rem;
}

.ctrl-group {
  display: flex;
  gap: 0.25rem;
}

.ctrl-toggle {
  position: fixed;
  top: 0;
  right: 0.75rem;
  z-index: 25;
  background: rgba(0,0,0,0.6);
  border-radius: 0 0 8px 8px;
  padding: 0.3rem 0.6rem;
  color: #aaa;
  font-size: 1rem;
  cursor: pointer;
  user-select: none;
}

.sync-toggle-btn.active {
  background: var(--chord, #f5c518);
  color: #000;
}

.tp-line-active .tp-lyric-below,
.tp-line-active.tp-lyric-row {
  color: var(--chord, #f5c518);
}

.tp-line-next .tp-lyric-below,
.tp-line-next.tp-lyric-row {
  color: rgba(245, 197, 24, 0.4);
}

.tp-line-tappable {
  cursor: pointer;
}

.nudge-btn {
  font-size: 0.75rem;
  padding: 0.5rem 0.5rem;
  min-width: 0;
  opacity: 0.8;
}

.yt-overlay {
  position: fixed;
  bottom: 4.5rem;
  right: 0.75rem;
  z-index: 20;
  border-radius: 10px;
  overflow: hidden;
  background: #111;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.7);
}

.yt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.5rem;
  background: rgba(255, 255, 255, 0.06);
}

.yt-label {
  font-size: 0.7rem;
  color: #888;
}

.yt-toggle-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 0.85rem;
  padding: 0 0.2rem;
  cursor: pointer;
}

.yt-player-el {
  width: 213px;
  height: 120px;
  display: block;
}

.yt-hidden .yt-player-el {
  display: none;
}
</style>
