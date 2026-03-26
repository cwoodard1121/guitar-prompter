<template>
  <div class="chord-chart" v-if="displayChords.length > 0">
    <h3 class="chord-chart-title">Chord Diagrams</h3>
    <div class="chord-grid">
      <div v-for="chord in displayChords" :key="chord.name" class="chord-item">
        <div class="chord-diagram-wrap">
          <ChordDiagram
            v-if="chord.data"
            :name="chord.name"
            :chord="chord.data"
            :tuning="['E', 'A', 'D', 'G', 'B', 'E']"
          />
          <div v-else class="chord-unknown">
            <div class="chord-unknown-box">?</div>
            <div class="chord-name">{{ chord.name }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ChordDiagram from './ChordDiagram.vue'
import { extractChordNames, getChord } from '../data/chords.js'

const props = defineProps({
  content: { type: String, default: '' }
})

const displayChords = computed(() =>
  extractChordNames(props.content).map(name => ({ name, data: getChord(name) }))
)
</script>

<style scoped>
.chord-chart {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 1rem;
}

.chord-chart-title {
  font-size: 0.95rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.chord-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-start;
}

.chord-item {
  flex: 0 0 auto;
}

.chord-diagram-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chord-unknown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.chord-unknown-box {
  width: 100px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #444;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 2rem;
}

.chord-unknown .chord-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-muted);
}
</style>
