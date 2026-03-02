import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import TooltipComponent from './components/TooltipComponent'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type WigglePlugin from '@jbrowse/plugin-wiggle'

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
       * Required for the y-scale bar to be displayed
       */
      get graphType() {
        return 'xyplot' as const
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
       */
      get TooltipComponent() {
        return TooltipComponent
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
      const {
        renderProps: superRenderProps,
        adapterProps: superAdapterProps,
      } = self
      return {
        /**
         * #getter
         * Synthesize a GWASVcfAdapter that wraps the parent track's VCF adapter.
         * This allows the adapter to compute stats from VCF FORMAT fields.
         */
        get adapterConfig() {
          const subadapter = getConf(self.parentTrack, 'adapter')
          return {
            type: 'GWASVcfAdapter',
            subadapter,
          }
        },
        /**
         * #method
         * Pass scoreField and sampleId to the adapter for stats calculation.
         */
        adapterProps() {
          const superProps = superAdapterProps()
          return {
            ...superProps,
            scoreField: self.scoreField,
            sampleId: self.sampleId,
          }
        },
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
