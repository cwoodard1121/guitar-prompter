<template>
  <div class="tp-root" :style="{ fontSize: fontSize + 'px' }">

    <!-- Tap zones (invisible, full height) — hidden when chord diagrams showing -->
    <div class="tap-zone tap-left" :class="{ disabled: showChordDiagrams }" @click="scrollBack"></div>
    <div class="tap-zone tap-right" :class="{ disabled: showChordDiagrams }" @click="scrollForward"></div>

    <!-- Song content -->
    <div ref="contentEl" class="tp-content">
      <div class="tp-song-header">
        <span v-if="setlist" class="tp-setlist-name">{{ setlist.name }} · {{ setlistIdx + 1 }}/{{ setlist.songIds?.length }}</span>
        <div class="tp-title-row">
          <span class="tp-title">{{ song?.title }}</span>
          <span v-if="syncMode" class="tp-sync-badge">⏱ Sync</span>
        </div>
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
              'tp-line-tappable': syncMode && activeTimings[i] !== null
            }"
            :ref="el => { if (el) lineRefs[i] = el }"
            @click.stop="syncMode && activeTimings[i] !== null && seekToLineByIndex(i)"
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
              'tp-line-tappable': syncMode && activeTimings[i] !== null
            }"
            :ref="el => { if (el) lineRefs[i] = el }"
            @click.stop="syncMode && activeTimings[i] !== null && seekToLineByIndex(i)"
          >{{ line.text }}</div>
          <div v-else-if="line.type === 'section'" class="tp-section-label">{{ line.label }}</div>
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
    <div class="tp-controls">
      <button class="ctrl-btn" @click="goHome">✕</button>
      <div class="ctrl-group">
        <button class="ctrl-btn" @click="fontSize = Math.max(14, fontSize - 2)">A−</button>
        <button class="ctrl-btn" @click="fontSize = Math.min(60, fontSize + 2)">A+</button>
      </div>
      <div class="ctrl-group">
        <button class="ctrl-btn" @click="transposeSteps--">♭</button>
        <button class="ctrl-btn transpose-val" :class="{ active: transposeSteps !== 0 }">{{ transposeSteps > 0 ? '+' + transposeSteps : transposeSteps }}</button>
        <button class="ctrl-btn" @click="transposeSteps++">♯</button>
      </div>
      <div v-if="!syncMode" class="ctrl-group">
        <button class="ctrl-btn" @click="speed = Math.max(5, speed - 5)">🐢</button>
        <button class="ctrl-btn speed-val">{{ speed }}</button>
        <button class="ctrl-btn" @click="speed = Math.min(200, speed + 5)">🐇</button>
      </div>
      <button class="ctrl-btn chord-toggle-btn" :class="{ active: showChordDiagrams }" @click="showChordDiagrams = !showChordDiagrams">
        🎸
      </button>
      <button v-if="hasSync || hasBpm" class="ctrl-btn sync-toggle-btn" :class="{ active: syncEnabled }" @click="toggleSync">
        ⏱ Sync
      </button>
      <template v-if="syncMode">
        <button class="ctrl-btn nudge-btn" @click="nudgeOffset(-0.5)" title="Lyrics ahead — shift back">−½s</button>
        <button class="ctrl-btn nudge-btn" @click="nudgeOffset(0.5)" title="Lyrics behind — shift forward">+½s</button>
      </template>
      <button v-if="!syncMode" class="ctrl-btn catchup-btn" @click="catchUp">
        ⏩
      </button>
    </div>

    <!-- Floating play bar (bottom) -->
    <div class="tp-play-bar">
      <template v-if="setlistId">
        <button class="play-bar-nav" :disabled="!hasPrevSong" @click="goPrevSong">‹</button>
      </template>
      <button class="play-bar-btn" @click="toggleScroll">
        {{ scrolling ? '⏸' : '▶' }}
      </button>
      <template v-if="setlistId">
        <button class="play-bar-nav" :disabled="!hasNextSong" @click="goNextSong">›</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import { useSetlistsStore } from '../stores/setlists.js'
import ChordDiagram from '../components/ChordDiagram.vue'
import { extractChordNames, getChord, transposeChord, transposeContent } from '../data/chords.js'
import { parseLrc, matchLrcToLines } from '../utils/parseLrc.js'

const route = useRoute()
const router = useRouter()
const store = useSongsStore()
const setlistsStore = useSetlistsStore()

// Setlist navigation
const setlistId = computed(() => route.query.setlist ?? null)
const setlistIdx = computed(() => setlistId.value ? parseInt(route.query.idx ?? '0') : -1)
const setlist = computed(() => setlistId.value ? setlistsStore.getSetlist(setlistId.value) : null)
const hasNextSong = computed(() => {
  if (!setlist.value) return false
  return setlistIdx.value < (setlist.value.songIds?.length ?? 0) - 1
})
const hasPrevSong = computed(() => setlistId.value && setlistIdx.value > 0)

function goNextSong() {
  if (!hasNextSong.value) return
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null }
  scrolling.value = false
  const nextId = setlist.value.songIds[setlistIdx.value + 1]
  router.push(`/song/${nextId}/play?setlist=${setlistId.value}&idx=${setlistIdx.value + 1}`)
}

function goPrevSong() {
  if (!hasPrevSong.value) return
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null }
  scrolling.value = false
  const prevId = setlist.value.songIds[setlistIdx.value - 1]
  router.push(`/song/${prevId}/play?setlist=${setlistId.value}&idx=${setlistIdx.value - 1}`)
}

const song = computed(() => store.getSong(route.params.id))
const contentEl = ref(null)
const fontSize = ref(24)
const speed = ref(40)
const scrolling = ref(false)
const showChordDiagrams = ref(false)
const capoFret = ref(0)
const transposeSteps = ref(0)

const displayContent = computed(() =>
  transposeSteps.value === 0
    ? (song.value?.content ?? '')
    : transposeContent(song.value?.content ?? '', transposeSteps.value)
)

// --- Sync mode ---
const syncEnabled = ref(false)
const playStartTime = ref(null)
const elapsed = ref(0)
const syncOffset = ref(0)   // seconds — positive = lyrics shift earlier, negative = later

function syncOffsetKey() { return `gp-sync-offset-${route.params.id}` }
function loadSavedOffset() {
  const saved = parseFloat(localStorage.getItem(syncOffsetKey()) || '0')
  syncOffset.value = isNaN(saved) ? 0 : saved
}
function saveSyncOffset() {
  localStorage.setItem(syncOffsetKey(), String(syncOffset.value))
}

watch(song, (s) => {
  if (s?.syncedLyrics) syncEnabled.value = true
  loadSavedOffset()
}, { immediate: true })
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
const chordNames = computed(() => extractChordNames(displayContent.value))

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
  if (!displayContent.value) return []
  const lines = displayContent.value.split('\n')
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

    if (/^\[(?:verse|chorus|bridge|intro|outro|pre-chorus|hook|interlude|solo)[^\]]*\]$/i.test(raw.trim())) {
      result.push({ type: 'section', label: raw.trim().slice(1, -1) })
      i++
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
const hasBpm = computed(() => !hasSync.value && !!song.value?.bpm)
const syncMode = computed(() => (hasSync.value || hasBpm.value) && syncEnabled.value)

// BPM mode: build synthetic timings from beat clock
// One lyric line per beatsPerLine beats
const beatsPerLine = ref(8)
const bpmTimings = computed(() => {
  if (!hasBpm.value || !song.value?.bpm) return []
  const bpm = song.value.bpm
  const secPerBeat = 60 / bpm
  const secPerLine = secPerBeat * beatsPerLine.value
  const timings = new Array(parsedLines.value.length).fill(null)
  let t = 0
  for (let i = 0; i < parsedLines.value.length; i++) {
    const type = parsedLines.value[i].type
    if (type !== 'blank' && type !== 'chord-only' && type !== 'section') {
      timings[i] = t
      t += secPerLine
    }
  }
  return timings
})

const activeTimings = computed(() => hasSync.value ? lineTimings.value : bpmTimings.value)

const currentSyncLine = computed(() => {
  if (!syncMode.value) return -1
  let best = -1
  for (let i = 0; i < activeTimings.value.length; i++) {
    const t = activeTimings.value[i]
    if (t !== null && t <= elapsed.value) best = i
  }
  return best
})

// Next timed line after current (for lookahead highlight)
const nextSyncLine = computed(() => {
  if (currentSyncLine.value < 0) return -1
  for (let i = currentSyncLine.value + 1; i < activeTimings.value.length; i++) {
    if (activeTimings.value[i] !== null) return i
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
  loadSavedOffset()
}

function nudgeOffset(delta) {
  syncOffset.value = Math.round((syncOffset.value + delta) * 10) / 10
  saveSyncOffset()
}

const CATCHUP_JUMP = 800
const PAGE_JUMP = 300

function catchUp() {
  contentEl.value.scrollBy({ top: CATCHUP_JUMP, behavior: 'smooth' })
}

function seekLine(delta) {
  const timings = activeTimings.value
  let target = currentSyncLine.value + delta
  while (target >= 0 && target < timings.length && timings[target] === null) target += delta
  if (target < 0 || target >= timings.length) return
  seekToLineByIndex(target)
}

function seekToLineByIndex(i) {
  const targetTime = activeTimings.value[i]
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
  /* honour notch / home indicator on PWA */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.tap-zone {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 30%;
  z-index: 10;
}
.tap-zone.disabled { pointer-events: none; }
.tap-left  { left: 0; }
.tap-right { right: 0; }

/* ── Scrollable content ─────────────────────────────────────── */
.tp-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5rem 1.25rem 10rem;
  scroll-behavior: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tp-content::-webkit-scrollbar { display: none; }

/* ── Song header ────────────────────────────────────────────── */
.tp-song-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5em;
  gap: 0.2em;
}
.tp-setlist-name { font-size: 0.7em; color: #888; margin-bottom: 0.1em; }
.tp-title  { font-size: 1.2em; font-weight: 700; color: #fff; }
.tp-artist { font-size: 0.85em; color: #aaa; }

/* ── Chord diagrams ─────────────────────────────────────────── */
.tp-chord-diagrams {
  background: rgba(255,255,255,0.05);
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
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.2);
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
.tp-sounds-as { font-size: 0.65em; color: #888; margin-top: -0.1em; }
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
  border: 2px dashed rgba(255,255,255,0.2);
  border-radius: 8px;
  color: #666;
  font-size: 1.5em;
}
.tp-diagram-name { font-weight: 700; font-size: 0.8em; color: #888; }

/* ── Lyric lines ────────────────────────────────────────────── */
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
.tp-chord-above.tp-chord-transition { opacity: 0.4; }
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
.tp-chord-solo { white-space: pre; }
.tp-lyric-row {
  line-height: 1.6;
  padding-bottom: 0.25em;
  color: #fff;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  transition: color 0.35s ease;
}
.tp-blank { height: 1.2em; }

.tp-section-label {
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--chord, #f5c518);
  opacity: 0.6;
  margin-top: 0.8em;
  margin-bottom: 0.2em;
}

/* ── Controls bar ───────────────────────────────────────────── */
.tp-controls {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  flex-wrap: wrap;           /* allow second row on tiny screens */
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  background: rgba(0,0,0,0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.25s ease;
}

.ctrl-btn {
  background: rgba(255,255,255,0.12);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: clamp(0.85rem, 3.5vw, 1.1rem);
  padding: 0.45rem 0.65rem;
  min-width: 2.2rem;
  text-align: center;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.chord-toggle-btn.active { background: var(--chord, #f5c518); color: #000; }
.sync-toggle-btn {
  min-width: auto;
  padding: 0.45rem 0.75rem;
  font-size: clamp(0.7rem, 2.8vw, 0.85rem);
  letter-spacing: 0.01em;
}
.sync-toggle-btn.active {
  background: var(--chord, #f5c518);
  color: #000;
  font-weight: 700;
}

.tp-title-row {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex-wrap: wrap;
}
.tp-sync-badge {
  font-size: 0.6em;
  font-weight: 700;
  background: rgba(245,197,24,0.18);
  color: var(--chord, #f5c518);
  border: 1px solid rgba(245,197,24,0.35);
  border-radius: 99px;
  padding: 0.2em 0.55em;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.catchup-btn { background: rgba(255,200,0,0.2); }
.catchup-btn:active { background: rgba(255,200,0,0.5); }

.speed-val {
  min-width: 2.4rem;
  font-size: clamp(0.75rem, 3vw, 0.9rem);
  pointer-events: none;
}
/* ── Floating play bar (bottom) ─────────────────────────────── */
.tp-play-bar {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 1rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 99px;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.1);
}
.play-bar-btn {
  background: var(--accent, #e94560);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.4rem;
  width: 3.2rem;
  height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.play-bar-btn:active { transform: scale(0.92); }
.play-bar-nav {
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.4rem;
  width: 2.6rem;
  height: 2.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.play-bar-nav:disabled { opacity: 0.2; }
.play-bar-nav:active:not(:disabled) { transform: scale(0.92); }
.ctrl-group { display: flex; gap: 0.2rem; }
.transpose-val {
  min-width: 2rem;
  font-size: 0.8rem;
  pointer-events: none;
  opacity: 0.7;
}
.transpose-val.active {
  opacity: 1;
  color: var(--chord, #f5c518);
}

.setlist-nav-btn {
  font-size: 1.3rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255,255,255,0.08);
}
.setlist-nav-btn:disabled { opacity: 0.2; }

.nudge-btn {
  font-size: clamp(0.65rem, 2.8vw, 0.8rem);
  padding: 0.45rem 0.45rem;
  min-width: 0;
  opacity: 0.85;
}


/* ── Sync highlights ────────────────────────────────────────── */
.tp-line-active .tp-lyric-below,
.tp-line-active.tp-lyric-row { color: var(--chord, #f5c518); }
.tp-line-next .tp-lyric-below,
.tp-line-next.tp-lyric-row   { color: rgba(245,197,24,0.4); }
.tp-line-tappable { cursor: pointer; }

/* ── YouTube overlay ────────────────────────────────────────── */
.yt-overlay {
  position: fixed;
  /* sit above the bottom safe area */
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  right: calc(0.75rem + env(safe-area-inset-right, 0px));
  z-index: 20;
  border-radius: 10px;
  overflow: hidden;
  background: #111;
  box-shadow: 0 4px 24px rgba(0,0,0,0.7);
  /* responsive width: 40% of viewport width, capped 160–260px */
  width: clamp(160px, 40vw, 260px);
}
.yt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.5rem;
  background: rgba(255,255,255,0.06);
}
.yt-label { font-size: 0.7rem; color: #888; }
.yt-toggle-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 0.85rem;
  padding: 0 0.2rem;
  cursor: pointer;
  touch-action: manipulation;
}
.yt-player-el {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
}
.yt-hidden .yt-player-el { display: none; }

/* ── Landscape phone: smaller YT overlay so lyrics still visible */
@media (max-height: 500px) {
  .yt-overlay { width: clamp(130px, 28vw, 200px); }
  .tp-content { padding-top: 4rem; }
}
</style>
