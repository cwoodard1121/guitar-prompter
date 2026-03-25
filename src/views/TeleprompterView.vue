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
      <button class="ctrl-btn catchup-btn" @click="catchUp">
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import ChordDiagram from '../components/ChordDiagram.vue'
import { extractChordNames, getChord, transposeChord } from '../data/chords.js'

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

const chordNames = computed(() => {
  if (!song.value?.content) return []
  return extractChordNames(song.value.content)
})

const displayChords = computed(() => {
  return chordNames.value.map(name => {
    let shapeName = capoFret.value > 0 ? transposeChord(name, -capoFret.value) : name
    return {
      displayName: name,
      shapeName,
      data: getChord(shapeName)
    }
  })
})

let rafId = null
let lastTime = null

const parsedLines = computed(() => {
  if (!song.value?.content) return []
  const lines = song.value.content.split('\n')
  const result = []

  for (const raw of lines) {
    if (!raw.trim()) {
      result.push({ type: 'blank' })
      continue
    }

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

const CATCHUP_JUMP = 800 // pixels per tap

function catchUp() {
  contentEl.value.scrollBy({ top: CATCHUP_JUMP, behavior: 'smooth' })
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

.tp-blank { height: 1em; }

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
</style>
