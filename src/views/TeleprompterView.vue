<template>
  <div class="tp-root" :style="{ fontSize: fontSize + 'px' }">

    <!-- Tap zones (invisible, full height) -->
    <div class="tap-zone tap-left" @click="scrollBack"></div>
    <div class="tap-zone tap-right" @click="scrollForward"></div>

    <!-- Song content -->
    <div ref="contentEl" class="tp-content">
      <div class="tp-song-header">
        <span class="tp-title">{{ song?.title }}</span>
        <span class="tp-artist">{{ song?.artist }}</span>
      </div>

      <!-- Chord diagrams panel -->
      <div v-if="showChordDiagrams" class="tp-chord-diagrams">
        <div class="tp-tuning-row">
          <button class="tp-capo-btn" :class="{ active: !useBarre }" @click="useBarre = false">Capo</button>
          <button class="tp-capo-btn" :class="{ active: useBarre }" @click="useBarre = true">No Capo</button>
          <select v-model="selectedTuning" class="tp-tuning-select">
            <option v-for="(tuning, key) in TUNINGS" :key="key" :value="key">
              {{ tuning.name }}
            </option>
          </select>
        </div>
        <div class="tp-diagram-grid">
          <div v-for="name in chordNames" :key="name" class="tp-diagram-item">
            <ChordDiagram
              v-if="getChord(name, useBarre)"
              :name="name"
              :chord="getChord(name, useBarre)"
              :tuning="currentTuning.strings"
            />
            <div v-else class="tp-diagram-unknown">
              <div class="tp-diagram-box">?</div>
              <div class="tp-diagram-name">{{ name }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tp-lines">
        <template v-for="(line, i) in parsedLines" :key="i">
          <div v-if="line.type === 'chord'" class="tp-chord-row">
            <span
              v-for="(seg, j) in line.segments"
              :key="j"
              class="tp-chord"
              :style="{ marginLeft: seg.offset + 'ch' }"
            >{{ seg.chord }}</span>
          </div>
          <div v-else-if="line.type === 'lyric'" class="tp-lyric-row">{{ line.text }}</div>
          <div v-else class="tp-blank"></div>
        </template>
      </div>
    </div>

    <!-- Controls overlay (top) -->
    <div class="tp-controls" :class="{ hidden: controlsHidden }">
      <button class="ctrl-btn" @click="goHome">✕</button>
      <div class="ctrl-group">
        <button class="ctrl-btn" @click="fontSize = Math.max(14, fontSize - 2)">A−</button>
        <button class="ctrl-btn" @click="fontSize = Math.min(60, fontSize + 2)">A+</button>
      </div>
      <div class="ctrl-group">
        <button class="ctrl-btn" @click="speed = Math.max(5, speed - 5)">🐢</button>
        <button class="ctrl-btn speed-val">{{ speed }}</button>
        <button class="ctrl-btn" @click="speed = Math.min(200, speed + 5)">🐇</button>
      </div>
      <button class="ctrl-btn chord-toggle-btn" :class="{ active: showChordDiagrams }" @click="showChordDiagrams = !showChordDiagrams">
        🎸
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import ChordDiagram from '../components/ChordDiagram.vue'
import { extractChordNames, getChord, TUNINGS } from '../data/chords.js'

const route = useRoute()
const router = useRouter()
const store = useSongsStore()

const song = computed(() => store.getSong(route.params.id))
const contentEl = ref(null)
const fontSize = ref(24)
const speed = ref(40)        // pixels per second
const scrolling = ref(false)
const controlsHidden = ref(false)
const showChordDiagrams = ref(false)
const selectedTuning = ref('Standard')
const useBarre = ref(false)

const currentTuning = computed(() => TUNINGS[selectedTuning.value] || TUNINGS['Standard'])

const chordNames = computed(() => {
  if (!song.value?.content) return []
  return extractChordNames(song.value.content)
})

let rafId = null
let lastTime = null

// Parse content: lines with [Chord] markers become chord rows above lyric rows
const parsedLines = computed(() => {
  if (!song.value?.content) return []
  const lines = song.value.content.split('\n')
  const result = []

  for (const raw of lines) {
    if (!raw.trim()) {
      result.push({ type: 'blank' })
      continue
    }

    // Detect chord-only lines: lines where all text is inside [] or spaces
    const chordLineMatch = /^\s*(\[[\w#b/]+\]\s*)+$/.test(raw)
    if (chordLineMatch) {
      const segments = []
      let offset = 0
      let cursor = 0
      const re = /\[([^\]]+)\]/g
      let m
      while ((m = re.exec(raw)) !== null) {
        const charsBeforeThisChord = m.index - cursor
        offset += charsBeforeThisChord
        segments.push({ chord: m[1], offset: cursor === 0 ? offset : charsBeforeThisChord })
        cursor = m.index + m[0].length
      }
      result.push({ type: 'chord', segments })
      continue
    }

    // Inline chords: strip [] for lyric display
    const lyric = raw.replace(/\[[\w#b/]+\]/g, '').trimEnd()
    result.push({ type: 'lyric', text: lyric || raw })
  }

  return result
})

function tick(ts) {
  if (!scrolling.value) return
  if (lastTime !== null) {
    const dt = (ts - lastTime) / 1000
    contentEl.value.scrollTop += speed.value * dt
  }
  lastTime = ts
  rafId = requestAnimationFrame(tick)
}

function toggleScroll() {
  scrolling.value = !scrolling.value
}

watch(scrolling, (val) => {
  if (val) {
    lastTime = null
    rafId = requestAnimationFrame(tick)
  } else {
    if (rafId) cancelAnimationFrame(rafId)
    lastTime = null
  }
})

const PAGE_JUMP = 300

function scrollForward() {
  contentEl.value.scrollBy({ top: PAGE_JUMP, behavior: 'smooth' })
}

function scrollBack() {
  contentEl.value.scrollBy({ top: -PAGE_JUMP, behavior: 'smooth' })
}

function goHome() {
  scrolling.value = false
  router.push('/')
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
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

/* Invisible tap zones */
.tap-zone {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 30%;
  z-index: 10;
}
.tap-left  { left: 0; }
.tap-right { right: 0; }

/* Scrollable content */
.tp-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5rem 1.5rem 6rem;
  scroll-behavior: auto;
  -webkit-overflow-scrolling: touch;
  /* Hide scrollbar */
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

/* Chord diagrams panel */
.tp-chord-diagrams {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5em;
}

.tp-tuning-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.tp-capo-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.35rem 0.7rem;
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

.tp-tuning-select {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  font-size: 0.75em;
  outline: none;
}

.tp-tuning-select option {
  background: #1a1a2e;
  color: #fff;
}

.tp-diagram-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.tp-diagram-item {
  flex: 0 0 auto;
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

/* Lines */
.tp-lines {
  display: flex;
  flex-direction: column;
}

.tp-chord-row {
  display: flex;
  flex-wrap: wrap;
  line-height: 1.2;
  min-height: 1.4em;
  padding-bottom: 0.1em;
}

.tp-chord {
  color: var(--chord, #f5c518);
  font-weight: 700;
  font-family: 'Courier New', monospace;
  white-space: pre;
}

.tp-lyric-row {
  line-height: 1.5;
  padding-bottom: 0.15em;
  color: #fff;
}

.tp-blank {
  height: 1em;
}

/* Controls */
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

.tp-controls.hidden {
  transform: translateY(-110%);
}

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

/* Toggle tab */
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
</style>
