import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/plugin-wiggle'

import type { ManhattanRegionData, ManhattanRenderState } from './manhattanBackendTypes'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  score: number
}

const HIT_RADIUS_PX = 8

export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  renderBlocks: RenderBlock[],
  regionData: Map<number, ManhattanRegionData>,
  state: ManhattanRenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight, scaleType } = state
  const height = canvasHeight - YSCALEBAR_LABEL_OFFSET * 2

  const normalizeScore = (score: number) => {
    if (scaleType === 1) {
      const logMin = Math.log2(Math.max(domainY[0], 1))
      const logMax = Math.log2(Math.max(domainY[1], 1))
      return Math.max(
        0,
        Math.min(1, (Math.log2(Math.max(score, 1)) - logMin) / (logMax - logMin)),
      )
    }
    return Math.max(0, Math.min(1, (score - domainY[0]) / (domainY[1] - domainY[0])))
  }

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of renderBlocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !refName) {
      continue
    }

    const bpLen = block.bpRangeX[1] - block.bpRangeX[0]
    const blockWidth = block.screenEndPx - block.screenStartPx
    if (blockWidth <= 0 || bpLen <= 0) {
      continue
    }
    const bpPerPx = bpLen / blockWidth

    for (let i = 0; i < data.numFeatures; i++) {
      const pos = data.positions[i]!
      const score = data.scores[i]!

      const ptX = block.reversed
        ? (block.bpRangeX[1] - pos) / bpPerPx + block.screenStartPx
        : (pos - block.bpRangeX[0]) / bpPerPx + block.screenStartPx
      const ptY = YSCALEBAR_LABEL_OFFSET + (1 - normalizeScore(score)) * height

      const dx = mouseX - ptX
      const dy = mouseY - ptY
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = { refName, start: pos, score }
      }
    }
  }

  return best
}
