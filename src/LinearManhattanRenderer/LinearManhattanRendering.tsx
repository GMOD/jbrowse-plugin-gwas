import React, { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import Flatbush from 'flatbush'
import { observer } from 'mobx-react'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const CLICK_SEARCH_BUFFER = 3

interface Props {
  width: number
  height: number
  clickMap: {
    index: ArrayBuffer
    items: { feature: SimpleFeatureSerialized }[]
  }
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
  onFeatureClick?: (event: React.MouseEvent, featureId?: string) => void
  // passed through to PrerenderedCanvas
  [key: string]: unknown
}

const LinearManhattanRendering = observer(function (props: Props) {
  const { height, onMouseLeave, onMouseMove, onFeatureClick, clickMap } = props
  const ref = useRef<HTMLDivElement>(null)
  const clickMapIndex = useMemo(
    () => Flatbush.from(clickMap.index),
    [clickMap.index],
  )

  function getFeatureUnderMouse(clientX: number, clientY: number) {
    if (!ref.current) {
      return undefined
    }
    const rect = ref.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const [firstIndex] = clickMapIndex.search(
      x,
      y,
      x + CLICK_SEARCH_BUFFER,
      y + CLICK_SEARCH_BUFFER,
    )
    const item =
      firstIndex !== undefined ? clickMap.items[firstIndex] : undefined
    return item ? new SimpleFeature(item.feature) : undefined
  }

  return (
    <div
      ref={ref}
      data-testid="manhattan-rendering"
      onMouseMove={e =>
        onMouseMove?.(e, getFeatureUnderMouse(e.clientX, e.clientY)?.id())
      }
      onClick={e =>
        onFeatureClick?.(e, getFeatureUnderMouse(e.clientX, e.clientY)?.id())
      }
      onMouseLeave={onMouseLeave}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default LinearManhattanRendering
