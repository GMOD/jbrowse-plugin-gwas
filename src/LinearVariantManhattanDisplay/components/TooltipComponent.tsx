import React from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { Tooltip } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export interface Props {
  feature: Feature
  model: Model
}
export interface Model {
  configuration: AnyConfigurationModel
  featureUnderMouse?: Feature
}

const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ model, feature }, ref) {
    return (
      <div ref={ref}>
        <SanitizedHTML html={getConf(model, 'mouseover', { feature })} />
      </div>
    )
  },
)

const TooltipComponent = observer(function (props: {
  model: Model
  height: number
  offsetMouseCoord: [number, number]
  clientMouseCoord: [number, number]
  clientRect?: DOMRect
}) {
  return <Tooltip TooltipContents={TooltipContents} {...props} />
})

export default TooltipComponent
