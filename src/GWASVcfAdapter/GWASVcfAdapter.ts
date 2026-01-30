import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { rectifyStats } from '@jbrowse/core/util/stats'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface GWASVcfOptions extends BaseOptions {
  scoreField?: string
  sampleId?: string
}

/**
 * Extract score from a VCF feature's FORMAT fields.
 */
function getScoreFromFeature(
  feature: Feature,
  scoreField: string,
  sampleId?: string,
): number {
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
  return 0
}

export default class GWASVcfAdapter extends BaseFeatureDataAdapter {
  private subadapterRef?: BaseFeatureDataAdapter

  protected async configure() {
    const subadapterConfig = this.getConf('subadapter')
    const dataAdapter = await this.getSubAdapter?.(subadapterConfig)

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    const subadapter = dataAdapter.dataAdapter as BaseFeatureDataAdapter
    this.subadapterRef = subadapter
    return { subadapter }
  }

  private async getConfiguredSubAdapter() {
    const { subadapter } = await this.configure()
    return subadapter
  }

  async getHeader(opts?: BaseOptions) {
    const subadapter = await this.getConfiguredSubAdapter()
    return subadapter.getHeader?.(opts)
  }

  getFeatures(region: Region, opts: GWASVcfOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const subadapter = await this.getConfiguredSubAdapter()
      const features = subadapter.getFeatures(region, opts)
      features.subscribe({
        next: feature => observer.next(feature),
        error: err => observer.error(err),
        complete: () => observer.complete(),
      })
    })
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const subadapter = await this.getConfiguredSubAdapter()
    return subadapter.getMultiRegionFeatureDensityStats?.(regions, opts)
  }

  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: GWASVcfOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const scoreField = opts.scoreField || 'LP'
    const sampleId = opts.sampleId || ''

    const stats = await Promise.all(
      regions.map(async region => {
        const features = await firstValueFrom(
          this.getFeatures(region, opts).pipe(toArray()),
        )

        let scoreMin = Number.MAX_VALUE
        let scoreMax = Number.MIN_VALUE
        let scoreSum = 0
        let scoreSumSquares = 0
        let featureCount = 0

        for (const feature of features) {
          const score = getScoreFromFeature(feature, scoreField, sampleId)
          if (!Number.isNaN(score) && Number.isFinite(score)) {
            scoreMin = Math.min(scoreMin, score)
            scoreMax = Math.max(scoreMax, score)
            scoreSum += score
            scoreSumSquares += score * score
            featureCount++
          }
        }

        return rectifyStats({
          scoreMin: featureCount > 0 ? scoreMin : 0,
          scoreMax: featureCount > 0 ? scoreMax : 0,
          scoreSum,
          scoreSumSquares,
          featureCount,
          basesCovered: featureCount,
        })
      }),
    )

    return aggregateQuantitativeStats(stats)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const subadapter = await this.getConfiguredSubAdapter()
    return subadapter.getRefNames(opts)
  }

  freeResources(region: Region) {
    // No caching implemented yet
  }
}
