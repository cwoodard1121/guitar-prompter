<template>
  <div class="chord-diagram">
    <div class="chord-svg" ref="svgContainer"></div>
    <div class="chord-name">{{ name }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { SVGuitarChord } from 'svguitar'

const props = defineProps({
  name: { type: String, required: true },
  chord: { type: Object, required: true }, // { fingers: [6th..1st], barres: [...] }
  tuning: { type: Array, default: () => ['E', 'A', 'D', 'G', 'B', 'E'] } // 6th to 1st
})

const svgContainer = ref(null)
let chart = null

function renderChord() {
  if (!svgContainer.value || !props.chord) return

  svgContainer.value.innerHTML = ''

  const fingers = props.chord.fingers // [6th, 5th, 4th, 3rd, 2nd, 1st]
  const barres = props.chord.barres || []

  // Convert to svguitar format
  // Our data index 0 = 6th string (low E) = svguitar string 1
  // Our data index 5 = 1st string (high E) = svguitar string 6
  // So svguitar string number = index + 1
  const svguitarFingers = []

  for (let i = 0; i < 6; i++) {
    const stringNum = i + 1 // svguitar string number (1=low E)
    const fret = fingers[i]

    if (fret === -1) {
      svguitarFingers.push([stringNum, 'x'])
    } else if (fret === 0) {
      // open string — svguitar shows 'O' automatically, no entry needed
    } else {
      svguitarFingers.push([stringNum, fret, fret.toString()])
    }
  }

  // Determine base fret and number of frets to show
  const activeFrets = fingers.filter(f => f > 0)
  const maxFret = activeFrets.length ? Math.max(...activeFrets) : 4
  const minFret = activeFrets.length ? Math.min(...activeFrets) : 1
  const baseFret = minFret > 1 ? minFret : 1
  const numFrets = Math.max(4, maxFret - baseFret + 1)

  // Adjust fingers for base fret offset
  const adjustedFingers = svguitarFingers.map(([string, fret, text]) => {
    if (typeof fret === 'number' && baseFret > 1) {
      return [string, fret - baseFret + 1, text]
    }
    return [string, fret, text]
  })

  // Convert barres — our data already uses 6=low E which matches svguitar
  const adjustedBarres = barres.map(barre => ({
    fromString: barre.fromString,
    toString: barre.toString,
    fret: baseFret > 1 ? barre.fret - baseFret + 1 : barre.fret
  }))

  // Tuning: our array is [6th,...,1st], svguitar expects [1st,...,6th] (left to right in vertical)
  // So reverse it
  const svguitarTuning = [...props.tuning].reverse()

  chart = new SVGuitarChord(svgContainer.value)
    .configure({
      tuning: svguitarTuning,
      strings: 6,
      frets: numFrets,
      position: baseFret,
      color: '#f5c518',
      strokeWidth: 2,
      fretSize: 1.2,
      emptyStringIndicatorSize: 0.6,
      fingerColor: '#f5c518',
      fingerTextColor: '#000',
      fingerStrokeColor: '#f5c518',
      stringColor: '#888',
      fretColor: '#888',
      tuningsColor: '#666',
      titleColor: '#f5c518',
      titleFontSize: 0, // hide title
      fretLabelColor: '#666'
    })
    .chord({
      fingers: adjustedFingers,
      barres: adjustedBarres
    })
    .draw()
}

onMounted(() => {
  nextTick(renderChord)
})

watch(() => [props.chord, props.tuning], () => {
  nextTick(renderChord)
}, { deep: true })
</script>

<style scoped>
.chord-diagram {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.chord-svg {
  width: 100px;
  height: 130px;
}

.chord-svg :deep(svg) {
  width: 100%;
  height: 100%;
}

.chord-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--chord, #f5c518);
  text-align: center;
}
</style>
