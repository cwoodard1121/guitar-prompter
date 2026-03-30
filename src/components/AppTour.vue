<template>
  <Teleport to="body">
    <div class="tour-backdrop" @click.self="close">
      <div class="tour-card" role="dialog" aria-modal="true" :aria-label="currentSlide.headline">

        <!-- Close button -->
        <button class="tour-close" @click="close" aria-label="Close tour">
          <X :size="16" />
        </button>

        <!-- Illustration area -->
        <div class="tour-illustration">
          <component :is="currentSlide.illustrationComponent" />
        </div>

        <!-- Slide content -->
        <div class="tour-body">
          <Transition :name="transitionName" mode="out-in">
            <div :key="step" class="tour-content">
              <div class="tour-icon">
                <component :is="currentSlide.iconComponent" :size="22" />
              </div>
              <h2 class="tour-headline">{{ currentSlide.headline }}</h2>
              <p class="tour-text">{{ currentSlide.body }}</p>
            </div>
          </Transition>
        </div>

        <!-- Step dots -->
        <div class="tour-dots" role="tablist" aria-label="Tour progress">
          <button
            v-for="(_, i) in slides"
            :key="i"
            class="tour-dot"
            :class="{ active: i === step }"
            @click="goTo(i)"
            :aria-label="`Go to slide ${i + 1}`"
            role="tab"
            :aria-selected="i === step"
          />
        </div>

        <!-- Navigation -->
        <div class="tour-nav">
          <button
            class="tour-btn tour-btn-secondary"
            :disabled="step === 0"
            @click="prev"
            aria-label="Previous slide"
          >
            <ChevronLeft :size="16" />
            Back
          </button>

          <div class="tour-nav-right">
            <template v-if="isLastSlide">
              <RouterLink
                v-if="currentSlide.cta"
                :to="currentSlide.cta.to"
                class="tour-btn tour-btn-cta"
                @click="close"
              >
                {{ currentSlide.cta.label }}
              </RouterLink>
              <button class="tour-btn-skip" @click="close">Skip</button>
            </template>
            <button
              v-else
              class="tour-btn tour-btn-primary"
              @click="next"
              aria-label="Next slide"
            >
              Next
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, defineComponent, h } from 'vue'
import { RouterLink } from 'vue-router'
import {
  X, ChevronLeft, ChevronRight,
  Guitar, Library, FilePlus, Play, ListMusic, Clock, Sparkles
} from 'lucide-vue-next'

const emit = defineEmits(['done'])

// ─── Illustration components ────────────────────────────────────────────────

const IllustrationWelcome = defineComponent({
  name: 'IllustrationWelcome',
  render() {
    return h('div', { class: 'illus illus-welcome' }, [
      h('div', { class: 'illus-glow' }),
      h('div', { class: 'illus-guitar' }, [
        h('div', { class: 'guitar-neck' }),
        h('div', { class: 'guitar-head' }),
        h('div', { class: 'guitar-body' }, [
          h('div', { class: 'guitar-hole' }),
        ]),
        h('div', { class: 'guitar-strings' },
          [1,2,3,4,5,6].map(i => h('div', { class: 'guitar-string', key: i }))
        ),
      ]),
      h('div', { class: 'illus-ring ring-1' }),
      h('div', { class: 'illus-ring ring-2' }),
      h('div', { class: 'illus-ring ring-3' }),
    ])
  }
})

const IllustrationLibrary = defineComponent({
  name: 'IllustrationLibrary',
  render() {
    const songs = [
      { title: 'Wonderwall', artist: 'Oasis', color: '#e8365d' },
      { title: 'Hotel California', artist: 'Eagles', color: '#7c6fff' },
      { title: 'Wish You Were Here', artist: 'Pink Floyd', color: '#f5c518' },
    ]
    return h('div', { class: 'illus illus-library' },
      songs.map((s, i) =>
        h('div', { class: 'lib-card', key: i, style: `--delay: ${i * 0.12}s` }, [
          h('div', { class: 'lib-thumb', style: `background: ${s.color}22; border-color: ${s.color}55` }, [
            h('div', { class: 'lib-thumb-bar', style: `background: ${s.color}` }),
          ]),
          h('div', { class: 'lib-info' }, [
            h('div', { class: 'lib-title' }, s.title),
            h('div', { class: 'lib-artist' }, s.artist),
          ]),
        ])
      )
    )
  }
})

const IllustrationAddSong = defineComponent({
  name: 'IllustrationAddSong',
  render() {
    return h('div', { class: 'illus illus-addsong' }, [
      h('div', { class: 'addsong-input' }, [
        h('div', { class: 'addsong-yt-dot' }),
        h('div', { class: 'addsong-url' }, 'youtube.com/watch?v=…'),
      ]),
      h('div', { class: 'addsong-arrow' }, '→'),
      h('div', { class: 'addsong-card' }, [
        h('div', { class: 'addsong-card-title' }, 'Wish You Were Here'),
        h('div', { class: 'addsong-card-artist' }, 'Pink Floyd'),
        h('div', { class: 'addsong-card-badge' }, 'AI Fill'),
      ]),
    ])
  }
})

const IllustrationTeleprompter = defineComponent({
  name: 'IllustrationTeleprompter',
  render() {
    const lines = [
      { chord: 'Am   C', lyric: 'So, so you think you can tell' },
      { chord: 'G    D', lyric: 'Heaven from Hell…' },
      { chord: 'Em   G', lyric: 'Blue skies from pain?' },
    ]
    return h('div', { class: 'illus illus-teleprompter' }, [
      h('div', { class: 'tele-screen' }, [
        h('div', { class: 'tele-lines' },
          lines.map((l, i) =>
            h('div', { class: 'tele-pair', key: i, style: `--di: ${i}` }, [
              h('div', { class: 'tele-chord' }, l.chord),
              h('div', { class: 'tele-lyric' }, l.lyric),
            ])
          )
        ),
        h('div', { class: 'tele-cursor' }),
      ])
    ])
  }
})

const IllustrationSetlist = defineComponent({
  name: 'IllustrationSetlist',
  render() {
    const items = ['Wonderwall', 'Hotel California', 'Creep', 'Blackbird']
    return h('div', { class: 'illus illus-setlist' }, [
      h('div', { class: 'setlist-board' }, [
        h('div', { class: 'setlist-header' }, "Tonight's Setlist"),
        h('div', { class: 'setlist-items' },
          items.map((name, i) =>
            h('div', { class: 'setlist-item', key: i, style: `--di: ${i}` }, [
              h('span', { class: 'setlist-num' }, `${i + 1}`),
              h('span', { class: 'setlist-name' }, name),
              i === 0 ? h('span', { class: 'setlist-now' }, '▶') : null,
            ])
          )
        ),
      ])
    ])
  }
})

const IllustrationSync = defineComponent({
  name: 'IllustrationSync',
  render() {
    return h('div', { class: 'illus illus-sync' }, [
      h('div', { class: 'sync-wave-wrap' }, [
        h('div', { class: 'sync-wave sw1' }),
        h('div', { class: 'sync-wave sw2' }),
        h('div', { class: 'sync-wave sw3' }),
      ]),
      h('div', { class: 'sync-clock' }, [
        h('div', { class: 'sync-clock-face' }, [
          h('div', { class: 'sync-hand sync-hour' }),
          h('div', { class: 'sync-hand sync-minute' }),
          h('div', { class: 'sync-center' }),
        ]),
      ]),
      h('div', { class: 'sync-dots' },
        [1,2,3,4,5].map(i =>
          h('div', { class: 'sync-dot', key: i, style: `--i: ${i}` })
        )
      ),
    ])
  }
})

const IllustrationReady = defineComponent({
  name: 'IllustrationReady',
  render() {
    return h('div', { class: 'illus illus-ready' }, [
      h('div', { class: 'ready-stage' }, [
        h('div', { class: 'ready-spotlight sp1' }),
        h('div', { class: 'ready-spotlight sp2' }),
        h('div', { class: 'ready-spotlight sp3' }),
      ]),
      h('div', { class: 'ready-star s1' }, '★'),
      h('div', { class: 'ready-star s2' }, '★'),
      h('div', { class: 'ready-star s3' }, '★'),
      h('div', { class: 'ready-text' }, 'READY'),
    ])
  }
})

// ─── Slide data ─────────────────────────────────────────────────────────────
const slides = [
  {
    iconComponent: Guitar,
    headline: 'Welcome to Guitar Portal',
    body: 'Your setlist, chords, and teleprompter — all in one place.',
    illustrationComponent: IllustrationWelcome,
  },
  {
    iconComponent: Library,
    headline: 'Your Song Library',
    body: 'All your songs in one place. Search, browse, and jump straight into performance mode.',
    illustrationComponent: IllustrationLibrary,
  },
  {
    iconComponent: FilePlus,
    headline: 'Add a Song',
    body: 'Paste a YouTube URL and we auto-fill the title and artist. Then add your chords and lyrics manually or paste them in.',
    illustrationComponent: IllustrationAddSong,
  },
  {
    iconComponent: Play,
    headline: 'The Teleprompter',
    body: 'Full-screen performance mode. Scrolling lyrics with chords above, transposition, and chord diagrams.',
    illustrationComponent: IllustrationTeleprompter,
  },
  {
    iconComponent: ListMusic,
    headline: 'Setlists',
    body: 'Group songs into a setlist for your gig. Navigate between songs mid-performance with prev/next.',
    illustrationComponent: IllustrationSetlist,
  },
  {
    iconComponent: Clock,
    headline: 'Sync & Auto-scroll',
    body: 'Fetch LRC sync data to time lyrics perfectly, or set a BPM to auto-scroll at song tempo.',
    illustrationComponent: IllustrationSync,
  },
  {
    iconComponent: Sparkles,
    headline: "You're ready to play",
    body: 'Add your first song and get on stage.',
    illustrationComponent: IllustrationReady,
    cta: { label: 'Add your first song', to: '/song/new' },
  },
]

// ─── State ───────────────────────────────────────────────────────────────────
const step = ref(0)
const direction = ref('forward')

const currentSlide = computed(() => slides[step.value])
const isLastSlide = computed(() => step.value === slides.length - 1)
const transitionName = computed(() => direction.value === 'forward' ? 'slide-forward' : 'slide-backward')

function next() {
  if (step.value < slides.length - 1) {
    direction.value = 'forward'
    step.value++
  }
}

function prev() {
  if (step.value > 0) {
    direction.value = 'backward'
    step.value--
  }
}

function goTo(i) {
  direction.value = i > step.value ? 'forward' : 'backward'
  step.value = i
}

function close() {
  emit('done')
}
</script>

<style scoped>
/* ─── Backdrop & card ───────────────────────────────────────────────────────── */
.tour-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.tour-card {
  position: relative;
  width: min(520px, 100%);
  background: var(--bg-card, #16162a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-lg, 16px);
  padding: 2rem;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
}

.tour-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm, 8px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, #6e6e98);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tour-close:hover {
  background: rgba(255,255,255,0.12);
  color: var(--text, #edeef5);
}

/* ─── Illustration ──────────────────────────────────────────────────────────── */
.tour-illustration {
  height: 160px;
  border-radius: calc(var(--radius-lg, 16px) - 4px);
  overflow: hidden;
  margin-bottom: 1.5rem;
  background: #0d0d1a;
  border: 1px solid rgba(255,255,255,0.05);
}

/* ─── Content (animated) ────────────────────────────────────────────────────── */
.tour-body {
  min-height: 100px;
  margin-bottom: 1.25rem;
}

.tour-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.tour-icon {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: var(--radius-sm, 8px);
  background: rgba(232, 54, 93, 0.12);
  border: 1px solid rgba(232, 54, 93, 0.2);
  color: var(--accent, #e8365d);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.2rem;
}

.tour-headline {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text, #edeef5);
  margin: 0;
  line-height: 1.3;
}

.tour-text {
  font-size: 0.9rem;
  color: var(--text-muted, #6e6e98);
  line-height: 1.65;
  margin: 0;
}

/* ─── Step dots ─────────────────────────────────────────────────────────────── */
.tour-dots {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 1.25rem;
}

.tour-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, transform 0.2s;
  flex-shrink: 0;
}

.tour-dot.active {
  background: var(--accent, #e8365d);
  transform: scale(1.3);
}

.tour-dot:hover:not(.active) {
  background: rgba(255,255,255,0.3);
}

/* ─── Navigation ────────────────────────────────────────────────────────────── */
.tour-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tour-nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tour-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm, 8px);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  text-decoration: none;
  white-space: nowrap;
  font-family: inherit;
}

.tour-btn-secondary {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, #6e6e98);
}
.tour-btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: var(--text, #edeef5);
}
.tour-btn-secondary:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tour-btn-primary {
  background: var(--accent, #e8365d);
  color: #fff;
}
.tour-btn-primary:hover {
  background: #d42d52;
}

.tour-btn-cta {
  background: var(--accent, #e8365d);
  color: #fff;
}
.tour-btn-cta:hover {
  background: #d42d52;
}

.tour-btn-skip {
  background: none;
  border: none;
  color: var(--text-muted, #6e6e98);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0.4rem 0.5rem;
  border-radius: var(--radius-sm, 8px);
  transition: color 0.15s;
  font-family: inherit;
}
.tour-btn-skip:hover {
  color: var(--text, #edeef5);
}

/* ─── Slide transitions ─────────────────────────────────────────────────────── */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-backward-enter-active,
.slide-backward-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.slide-forward-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-backward-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-backward-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* ─── ILLUSTRATIONS ─────────────────────────────────────────────────────────── */

/* Base illustration container — rendered by inline defineComponent → render fn,
   so child elements are NOT scoped. Use :deep() to pierce the boundary. */

:deep(.illus) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* ── Welcome: guitar with pulse rings ── */
:deep(.illus-welcome) {
  background: radial-gradient(ellipse at center, #1a0812 0%, #080810 100%);
}

:deep(.illus-glow) {
  position: absolute;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232,54,93,0.3) 0%, transparent 70%);
  animation: pulse-glow 2.4s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.35); opacity: 1; }
}

:deep(.illus-guitar) {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
}

:deep(.guitar-body) {
  width: 54px;
  height: 66px;
  background: linear-gradient(145deg, #e8365d, #b01d40);
  border-radius: 50% 50% 46% 46% / 44% 44% 56% 56%;
  box-shadow: 0 0 24px rgba(232,54,93,0.5), inset 0 -4px 10px rgba(0,0,0,0.4);
  position: relative;
  order: 2;
}

:deep(.guitar-hole) {
  position: absolute;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.1);
}

:deep(.guitar-neck) {
  width: 10px;
  height: 38px;
  background: linear-gradient(to bottom, #c8843a, #8b5a2b);
  border-radius: 2px;
  order: 1;
  position: relative;
  z-index: 1;
}

:deep(.guitar-head) {
  width: 16px;
  height: 12px;
  background: linear-gradient(to bottom, #c8843a, #8b5a2b);
  border-radius: 3px 3px 0 0;
  order: 0;
}

:deep(.guitar-strings) {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  height: 100%;
  align-items: flex-start;
  z-index: 3;
  pointer-events: none;
}

:deep(.guitar-string) {
  width: 1px;
  height: 100%;
  background: rgba(255,255,255,0.2);
}

:deep(.illus-ring) {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(232,54,93,0.18);
  animation: ring-expand 2.8s ease-out infinite;
  pointer-events: none;
}
:deep(.ring-1) { width: 90px;  height: 90px;  animation-delay: 0s; }
:deep(.ring-2) { width: 130px; height: 130px; animation-delay: 0.7s; }
:deep(.ring-3) { width: 172px; height: 172px; animation-delay: 1.4s; }

@keyframes ring-expand {
  0%   { transform: scale(0.75); opacity: 0.7; }
  100% { transform: scale(1.05); opacity: 0; }
}

/* ── Library: stacked song cards ── */
:deep(.illus-library) {
  background: linear-gradient(160deg, #0e0e1c 0%, #12102a 100%);
  flex-direction: column;
  gap: 6px;
  padding: 14px 20px;
  align-items: stretch;
}

:deep(.lib-card) {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 8px 10px;
  animation: lib-slide-in 0.4s ease both;
  animation-delay: var(--delay, 0s);
}

@keyframes lib-slide-in {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
}

:deep(.lib-thumb) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid;
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 3px;
}

:deep(.lib-thumb-bar) {
  width: 12px;
  height: 18px;
  border-radius: 2px 2px 0 0;
  opacity: 0.85;
}

:deep(.lib-info) { flex: 1; min-width: 0; }

:deep(.lib-title) {
  font-size: 0.72rem;
  font-weight: 600;
  color: #edeef5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.lib-artist) {
  font-size: 0.6rem;
  color: #6e6e98;
  margin-top: 2px;
}

/* ── Add Song ── */
:deep(.illus-addsong) {
  background: linear-gradient(150deg, #0c0c1e 0%, #14101e 100%);
  gap: 10px;
  flex-direction: row;
  padding: 0 18px;
}

:deep(.addsong-input) {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 7px;
  padding: 8px 10px;
  flex: 1;
  min-width: 0;
}

:deep(.addsong-yt-dot) {
  width: 14px;
  height: 10px;
  background: #e8365d;
  border-radius: 3px;
  flex-shrink: 0;
  position: relative;
}

:deep(.addsong-yt-dot::after) {
  content: '';
  position: absolute;
  top: 50%;
  left: 55%;
  transform: translate(-50%, -50%);
  border-left: 5px solid white;
  border-top: 3px solid transparent;
  border-bottom: 3px solid transparent;
}

:deep(.addsong-url) {
  font-size: 0.58rem;
  color: #6e6e98;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.addsong-arrow) {
  font-size: 1.3rem;
  color: #7c6fff;
  flex-shrink: 0;
  animation: arrow-pulse 1.4s ease-in-out infinite;
}

@keyframes arrow-pulse {
  0%, 100% { transform: translateX(0); opacity: 0.6; }
  50%       { transform: translateX(5px); opacity: 1; }
}

:deep(.addsong-card) {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(124,111,255,0.22);
  border-radius: 8px;
  padding: 10px;
  flex: 1;
  min-width: 0;
}

:deep(.addsong-card-title) {
  font-size: 0.68rem;
  font-weight: 600;
  color: #edeef5;
}

:deep(.addsong-card-artist) {
  font-size: 0.58rem;
  color: #6e6e98;
  margin-top: 2px;
}

:deep(.addsong-card-badge) {
  display: inline-block;
  margin-top: 5px;
  font-size: 0.55rem;
  font-weight: 700;
  padding: 2px 5px;
  background: rgba(232,54,93,0.15);
  border: 1px solid rgba(232,54,93,0.3);
  color: #e8365d;
  border-radius: 4px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* ── Teleprompter ── */
:deep(.illus-teleprompter) {
  background: #070712;
  padding: 12px;
}

:deep(.tele-screen) {
  width: 100%;
  height: 100%;
  background: #0a0a1a;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 14px 16px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

:deep(.tele-lines) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

:deep(.tele-pair) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: tele-in 0.5s ease both;
  animation-delay: calc(var(--di) * 0.18s);
}

@keyframes tele-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

:deep(.tele-chord) {
  font-size: 0.62rem;
  font-weight: 700;
  color: #f5c518;
  font-family: monospace;
  letter-spacing: 0.08em;
}

:deep(.tele-lyric) {
  font-size: 0.72rem;
  color: rgba(237,238,245,0.88);
}

:deep(.tele-cursor) {
  position: absolute;
  left: 0;
  right: 0;
  top: 44%;
  height: 1.5px;
  background: linear-gradient(90deg, transparent 0%, rgba(232,54,93,0.45) 40%, rgba(232,54,93,0.45) 60%, transparent 100%);
}

/* ── Setlist ── */
:deep(.illus-setlist) {
  background: linear-gradient(150deg, #0c0c1e 0%, #0f0e1a 100%);
  padding: 12px 16px;
  align-items: stretch;
}

:deep(.setlist-board) {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(124,111,255,0.14);
  border-radius: 10px;
  overflow: hidden;
}

:deep(.setlist-header) {
  padding: 7px 12px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7c6fff;
  background: rgba(124,111,255,0.1);
  border-bottom: 1px solid rgba(124,111,255,0.1);
}

:deep(.setlist-items) {
  display: flex;
  flex-direction: column;
}

:deep(.setlist-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  animation: setlist-in 0.4s ease both;
  animation-delay: calc(var(--di) * 0.09s);
}
:deep(.setlist-item:last-child) { border-bottom: none; }

@keyframes setlist-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}

:deep(.setlist-num) {
  font-size: 0.58rem;
  color: #6e6e98;
  width: 12px;
  text-align: right;
  flex-shrink: 0;
}

:deep(.setlist-name) {
  font-size: 0.68rem;
  color: #edeef5;
  flex: 1;
}

:deep(.setlist-now) {
  font-size: 0.55rem;
  color: #e8365d;
}

/* ── Sync ── */
:deep(.illus-sync) {
  background: radial-gradient(ellipse at center, #0e0c1c 0%, #080810 100%);
  gap: 28px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

:deep(.sync-wave-wrap) {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

:deep(.sync-wave) {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(124,111,255,0.2);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: wave-out 2.2s ease-out infinite;
}
:deep(.sw1) { width: 80px;  height: 80px;  animation-delay: 0s; }
:deep(.sw2) { width: 114px; height: 114px; animation-delay: 0.55s; }
:deep(.sw3) { width: 148px; height: 148px; animation-delay: 1.1s; }

@keyframes wave-out {
  0%   { opacity: 0.7; transform: translate(-50%,-50%) scale(0.6); }
  100% { opacity: 0;   transform: translate(-50%,-50%) scale(1); }
}

:deep(.sync-clock) {
  position: relative;
  z-index: 2;
}

:deep(.sync-clock-face) {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  border: 2px solid rgba(124,111,255,0.55);
  background: rgba(124,111,255,0.07);
  position: relative;
  box-shadow: 0 0 22px rgba(124,111,255,0.25), inset 0 0 12px rgba(124,111,255,0.05);
}

:deep(.sync-hand) {
  position: absolute;
  bottom: 50%;
  left: 50%;
  transform-origin: bottom center;
  border-radius: 2px;
  background: #7c6fff;
}

:deep(.sync-hour) {
  width: 3px;
  height: 20px;
  margin-left: -1.5px;
  animation: clock-spin 8s linear infinite;
}

:deep(.sync-minute) {
  width: 2px;
  height: 27px;
  margin-left: -1px;
  animation: clock-spin 2s linear infinite;
}

@keyframes clock-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

:deep(.sync-center) {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7c6fff;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px #7c6fff;
}

:deep(.sync-dots) {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
  z-index: 2;
}

:deep(.sync-dot) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7c6fff;
  animation: dot-bounce 1.1s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.13s);
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scaleY(0.5); opacity: 0.3; }
  40%           { transform: scaleY(1.5); opacity: 1; }
}

/* ── Ready ── */
:deep(.illus-ready) {
  background: #060612;
  overflow: hidden;
  position: relative;
}

:deep(.ready-stage) {
  position: absolute;
  inset: 0;
}

:deep(.ready-spotlight) {
  position: absolute;
  top: -20px;
  width: 0;
  height: 0;
  border-left: 44px solid transparent;
  border-right: 44px solid transparent;
  border-top: 200px solid transparent;
  opacity: 0.07;
}

:deep(.sp1) {
  left: 10%;
  border-top-color: #e8365d;
  animation: spot-sway 3.5s ease-in-out infinite;
}

:deep(.sp2) {
  left: 40%;
  border-top-color: #ffffff;
  animation: spot-sway 3.5s ease-in-out infinite 0.5s;
  opacity: 0.1;
}

:deep(.sp3) {
  right: 10%;
  border-top-color: #7c6fff;
  animation: spot-sway 3.5s ease-in-out infinite 1s;
}

@keyframes spot-sway {
  0%, 100% { transform: rotate(-8deg); }
  50%       { transform: rotate(8deg); }
}

:deep(.ready-text) {
  position: relative;
  z-index: 2;
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  background: linear-gradient(135deg, #e8365d 0%, #ff8fa0 40%, #7c6fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ready-pulse 2s ease-in-out infinite;
}

@keyframes ready-pulse {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.04); }
}

:deep(.ready-star) {
  position: absolute;
  z-index: 3;
  color: #f5c518;
  animation: star-twinkle 1.8s ease-in-out infinite;
}

:deep(.s1) { font-size: 1rem;   top: 20px; left: 28%;  animation-delay: 0s; }
:deep(.s2) { font-size: 0.75rem; top: 14px; right: 26%; animation-delay: 0.6s; }
:deep(.s3) { font-size: 0.85rem; bottom: 22px; left: 52%; animation-delay: 1.2s; }

@keyframes star-twinkle {
  0%, 100% { transform: scale(1) rotate(0deg);   opacity: 0.5; }
  50%       { transform: scale(1.5) rotate(20deg); opacity: 1; }
}

/* ─── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 540px) {
  .tour-card {
    padding: 1.5rem 1.25rem;
  }

  .tour-illustration {
    height: 130px;
  }

  .tour-headline {
    font-size: 1.1rem;
  }
}
</style>
