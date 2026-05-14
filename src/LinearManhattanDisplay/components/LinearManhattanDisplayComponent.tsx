import React, { useCallback, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { useGpuModelLifecycle } from '@jbrowse/core/util/useGpuModelLifecycle'
import { observer } from 'mobx-react'

import { ManhattanRenderer } from '../ManhattanRenderer'
import { findManhattanHit } from '../findManhattanHit'
import TooltipComponent from './TooltipComponent'

import type { ManhattanHit } from '../findManhattanHit'
import type { ManhattanBackend, ManhattanRenderState } from '../manhattanBackendTypes'
import type { ManhattanRpcResult } from '../../RenderManhattanDataRPC/rpcTypes'
import type { TooltipModel } from './TooltipComponent'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuModelLifecycle'
import type { ObservableMap } from 'mobx'

interface VisibleRegion {
  displayedRegionIndex: number
  refName: string
}

interface LGV {
  trackWidthPx: number
  visibleRegions: VisibleRegion[]
}

interface ManhattanDisplayModel extends GpuLifecycleModel<ManhattanBackend>, TooltipModel {
  canvasDrawn: boolean
  height: number
  manhattanRpcDataMap: ObservableMap<number, ManhattanRpcResult>
  manhattanRenderState: ManhattanRenderState | undefined
  renderBlocks: RenderBlock[]
  setManhattanFeatureUnderMouse(hit: ManhattanHit | undefined): void
}

const COORD0: [number, number] = [0, 0]

const LinearManhattanDisplayComponent = observer(function LinearManhattanDisplayComponent({
  model,
}: {
  model: ManhattanDisplayModel
}) {
  const { canvasRef } = useGpuModelLifecycle(ManhattanRenderer, model)
  const view = getContainingView(model) as unknown as LGV
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      setClientMouseCoord([event.clientX, event.clientY])

      const { manhattanRenderState, renderBlocks, manhattanRpcDataMap } = model
      if (!manhattanRenderState) {
        return
      }
      const refNames = new Map(
        view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
      )
      model.setManhattanFeatureUnderMouse(
        findManhattanHit(
          event.clientX - rect.left,
          event.clientY - rect.top,
          renderBlocks,
          manhattanRpcDataMap,
          manhattanRenderState,
          refNames,
        ),
      )
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setManhattanFeatureUnderMouse(undefined)
  }, [model])

  const width = view.trackWidthPx
  const height = model.height

  return (
    <div
      data-testid={model.canvasDrawn ? 'manhattan-gpu-done' : 'manhattan-gpu'}
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
    </div>
  )
})

export default LinearManhattanDisplayComponent
