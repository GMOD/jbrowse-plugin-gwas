import { readConfObject } from '@jbrowse/core/configuration'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { getScale } from '@jbrowse/plugin-wiggle'
import Flatbush from 'flatbush'

import { checkStopToken } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature, Region } from '@jbrowse/core/util'

const TWO_PI = Math.PI * 2
const YSCALEBAR_LABEL_OFFSET = 5
const POINT_RADIUS = 2

/**
 * Extract score from a feature.
 * For VCF features with GWAS data, extracts from FORMAT fields.
 * Otherwise uses the standard 'score' attribute.
 */
function getScore(
  feature: Feature,
  scoreField?: string,
  sampleId?: string,
): number {
  if (scoreField) {
    const samples = feature.get('samples') as
      | Record<string, Record<string, unknown[]>>
      | undefined
    if (samples) {
      const sampleIds = Object.keys(samples)
      const targetSampleId =
        sampleId && sampleId in samples ? sampleId : sampleIds[0]
      if (targetSampleId) {
        const sampleData = samples[targetSampleId]
        if (sampleData) {
          const value = sampleData[scoreField]
          if (value !== undefined) {
            const numValue = Array.isArray(value) ? value[0] : value
            return Number(numValue)
          }
        }
      }
    }
  }
  return feature.get('score') as number
}

interface ManhattanRenderProps extends RenderArgsDeserialized {
  features: Map<string, Feature>
  regions: Region[]
  bpPerPx: number
  statusCallback?: (arg: string) => void
  config: AnyConfigurationModel
  scaleOpts: {
    domain: number[]
    scaleType: string
    pivotValue?: number
    inverted?: boolean
  }
  height: number
  displayCrossHatches: boolean
  ticks: { values: number[] }
  highResolutionScaling?: number
  // For GWAS-VCF support: extract score from VCF FORMAT fields
  scoreField?: string
  sampleId?: string
}

interface ClickMapItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  feature: ReturnType<Feature['toJSON']>
}

export default class ManhattanPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: ManhattanRenderProps) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const rest = await updateStatus('Rendering plot', statusCallback, () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        this.draw(ctx, {
          ...renderProps,
          features,
        }),
      ),
    )

    const results = await super.render({
      ...renderProps,
      ...rest,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...rest,
      features,
      height,
      width,
      containsNoTransferables: true,
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    props: ManhattanRenderProps & { features: Map<string, Feature> },
  ) {
    const {
      features,
      regions,
      bpPerPx,
      config,
      scaleOpts,
      height: unadjustedHeight,
      displayCrossHatches,
      ticks: { values },
      stopToken,
    } = props
    const region = regions[0]!
    const height = unadjustedHeight - YSCALEBAR_LABEL_OFFSET * 2
    const width = (region.end - region.start) / bpPerPx
    const pxPerBp = 1 / bpPerPx
    const regionStart = region.start

    const scale = getScale({
      ...scaleOpts,
      range: [0, height],
    })
    const toY = (n: number) => height + YSCALEBAR_LABEL_OFFSET - scale(n)

    const colorCallback = config.color.isCallback
    const colorValue = config.color.value as string
    // Batched drawing (single beginPath/fill) is faster but doesn't work with
    // alpha blending since overlapping circles would blend incorrectly
    const canBatch =
      !colorCallback &&
      !colorValue.includes('rgba') &&
      !colorValue.includes('hsla')

    const { scoreField, sampleId } = props
    const items = this.drawPoints(ctx, {
      features,
      regionStart,
      pxPerBp,
      toY,
      config,
      colorValue,
      colorCallback,
      canBatch,
      stopToken,
      scoreField,
      sampleId,
    })

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      for (const tick of values) {
        const y = Math.round(toY(tick))
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()
    }

    const index = new Flatbush(Math.max(items.length, 1))
    if (items.length === 0) {
      index.add(0, 0, 0, 0)
    } else {
      for (const item of items) {
        index.add(item.minX, item.minY, item.maxX, item.maxY)
      }
    }
    index.finish()
    return { clickMap: { index: index.data, items } }
  }

  drawPoints(
    ctx: CanvasRenderingContext2D,
    opts: {
      features: Map<string, Feature>
      regionStart: number
      pxPerBp: number
      toY: (n: number) => number
      config: AnyConfigurationModel
      colorValue: string
      colorCallback: boolean
      canBatch: boolean
      stopToken?: string
      scoreField?: string
      sampleId?: string
    },
  ) {
    const {
      features,
      regionStart,
      pxPerBp,
      toY,
      config,
      colorValue,
      colorCallback,
      canBatch,
      stopToken,
      scoreField,
      sampleId,
    } = opts
    const items: ClickMapItem[] = []
    let lastX = 0
    let lastY = 0
    let checkTime = performance.now()
    let i = 0

    const addPoint = (feature: Feature, x: number, y: number) => {
      if (Math.abs(x - lastX) > 1 || Math.abs(y - lastY) > 1) {
        lastX = x
        lastY = y
        items.push({
          minX: x - POINT_RADIUS,
          minY: y - POINT_RADIUS,
          maxX: x + POINT_RADIUS,
          maxY: y + POINT_RADIUS,
          feature: feature.toJSON(),
        })
        return true
      }
      return false
    }

    // Split into two loops for performance - the batched path avoids
    // repeated beginPath/fill calls and color lookups
    if (canBatch) {
      ctx.fillStyle = colorValue
      ctx.beginPath()
      for (const feature of features.values()) {
        if (i++ % 100 === 0 && performance.now() - checkTime > 200) {
          checkStopToken(stopToken)
          checkTime = performance.now()
        }
        const x = (feature.get('start') - regionStart) * pxPerBp
        const y = toY(getScore(feature, scoreField, sampleId))
        if (addPoint(feature, x, y)) {
          ctx.moveTo(x + POINT_RADIUS, y)
          ctx.arc(x, y, POINT_RADIUS, 0, TWO_PI)
        }
      }
      ctx.fill()
    } else {
      ctx.fillStyle = colorValue
      for (const feature of features.values()) {
        if (i++ % 100 === 0 && performance.now() - checkTime > 200) {
          checkStopToken(stopToken)
          checkTime = performance.now()
        }
        const x = (feature.get('start') - regionStart) * pxPerBp
        const y = toY(getScore(feature, scoreField, sampleId))
        if (addPoint(feature, x, y)) {
          if (colorCallback) {
            ctx.fillStyle = readConfObject(config, 'color', { feature })
          }
          ctx.beginPath()
          ctx.arc(x, y, POINT_RADIUS, 0, TWO_PI)
          ctx.fill()
        }
      }
    }

    return items
  }
}
