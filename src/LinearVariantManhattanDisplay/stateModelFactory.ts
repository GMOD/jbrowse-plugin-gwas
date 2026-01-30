import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type WigglePlugin from '@jbrowse/plugin-wiggle'

/**
 * Extract score from a VCF feature's FORMAT fields for stats estimation.
 */
function getScoreFromVcfFeature(
  feature: Feature,
  scoreField: string,
  sampleId: string,
) {
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

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const WigglePlugin = pluginManager.getPlugin('WigglePlugin') as WigglePlugin
  const { linearWiggleDisplayModelFactory } = WigglePlugin.exports
  return types
    .compose(
      'LinearVariantManhattanDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearVariantManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'LinearManhattanRenderer'
      },
      /**
       * #getter
       */
      get needsScalebar() {
        return true
      },
      /**
       * #getter
       */
      get regionTooLarge() {
        return false
      },
      /**
       * #getter
       */
      get scoreField() {
        return getConf(self, 'scoreField') as string
      },
      /**
       * #getter
       */
      get sampleId() {
        return getConf(self, 'sampleId') as string
      },
      /**
       * #getter
       * Custom stats estimation feature parser that extracts scores from VCF
       * FORMAT fields (e.g., LP field for GWAS-VCF files).
       */
      get statsEstimationFeatureParser() {
        const scoreField = self.scoreField
        const sampleId = self.sampleId
        return (feature: Feature) =>
          getScoreFromVcfFeature(feature, scoreField, sampleId)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * this overrides the BaseLinearDisplayModel to avoid popping up a
       * feature detail display, but still sets the feature selection on the
       * model so listeners can detect a click
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              view: getContainingView(self),
              track: getContainingTrack(self),
              featureData: feature.toJSON(),
            },
          )
          session.showWidget(featureWidget)
        }
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            config: self.rendererConfig,
            scoreField: self.scoreField,
            sampleId: self.sampleId,
          }
        },
      }
    })
}

export type LinearVariantManhattanDisplayModel = ReturnType<
  typeof stateModelFactory
>
