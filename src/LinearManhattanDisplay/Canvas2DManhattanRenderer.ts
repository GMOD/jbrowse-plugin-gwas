import { getDpr, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import type { ManhattanBackend, ManhattanRegionData, ManhattanRenderState } from './manhattanBackendTypes'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

const TWO_PI = Math.PI * 2
const YSCALEBAR_LABEL_OFFSET = 5

export class Canvas2DManhattanRenderer implements ManhattanBackend {
  private canvas: HTMLCanvasElement
  private regionData = new Map<number, ManhattanRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(displayedRegionIndex: number, data: ManhattanRegionData) {
    if (data.numFeatures === 0) {
      this.regionData.delete(displayedRegionIndex)
    } else {
      this.regionData.set(displayedRegionIndex, data)
    }
  }

  pruneRegions(activeRegions: number[]) {
    const active = new Set(activeRegions)
    for (const key of this.regionData.keys()) {
      if (!active.has(key)) {
        this.regionData.delete(key)
      }
    }
  }

  renderBlocks(blocks: RenderBlock[], state: ManhattanRenderState): boolean {
    const { canvasWidth, canvasHeight, domainY, scaleType, pointRadius } = state
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      return false
    }

    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const height = canvasHeight - YSCALEBAR_LABEL_OFFSET * 2
    const dpr = getDpr()

    const normalizeScore = (score: number) => {
      if (scaleType === 1) {
        const logMin = Math.log2(Math.max(domainY[0], 1))
        const logMax = Math.log2(Math.max(domainY[1], 1))
        const logScore = Math.log2(Math.max(score, 1))
        return Math.max(0, Math.min(1, (logScore - logMin) / (logMax - logMin)))
      }
      return Math.max(0, Math.min(1, (score - domainY[0]) / (domainY[1] - domainY[0])))
    }

    let drew = false
    for (const block of blocks) {
      const data = this.regionData.get(block.displayedRegionIndex)
      if (!data) {
        continue
      }

      const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
      const blockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx = bpLength / blockWidth
      const regionStart = block.bpRangeX[0]

      ctx.save()
      ctx.beginPath()
      ctx.rect(block.screenStartPx * dpr, 0, blockWidth * dpr, canvasHeight * dpr)
      ctx.clip()

      for (let i = 0; i < data.numFeatures; i++) {
        const pos = data.positions[i]!
        const score = data.scores[i]!
        const color = data.colors[i]!

        const x = (block.reversed
          ? (block.bpRangeX[1] - pos) / bpPerPx + block.screenStartPx
          : (pos - regionStart) / bpPerPx + block.screenStartPx) * dpr
        const y = (YSCALEBAR_LABEL_OFFSET + (1 - normalizeScore(score)) * height) * dpr

        const r = (color >>> 0) & 0xFF
        const g = (color >>> 8) & 0xFF
        const b = (color >>> 16) & 0xFF
        const a = (color >>> 24) & 0xFF
        ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
        ctx.beginPath()
        ctx.arc(x, y, pointRadius * dpr, 0, TWO_PI)
        ctx.fill()
      }

      ctx.restore()
      drew = true
    }
    return drew
  }

  dispose() {
    this.regionData.clear()
  }
}
