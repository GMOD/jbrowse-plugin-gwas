import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DManhattanRenderer } from './Canvas2DManhattanRenderer'
import { GpuManhattanRenderer, MANHATTAN_PASSES } from './GpuManhattanRenderer'
import * as shader from './shaders/manhattan.generated'

import type { ManhattanBackend } from './manhattanBackendTypes'

export function ManhattanRenderer(canvas: HTMLCanvasElement): Promise<ManhattanBackend> {
  return initDualBackend<ManhattanBackend>(
    canvas,
    MANHATTAN_PASSES,
    shader.UNIFORMS_SIZE_BYTES,
    hal => new GpuManhattanRenderer(hal),
    c => new Canvas2DManhattanRenderer(c),
  )
}
