import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'

import TooltipComponent from './components/TooltipComponent'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type WigglePlugin from '@jbrowse/plugin-wiggle'

// lazies
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const WigglePlugin = pluginManager.getPlugin('WigglePlugin') as WigglePlugin
  const { linearWiggleDisplayModelFactory } = WigglePlugin.exports
  return types
    .compose(
      'LinearManhattanDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get TooltipComponent() {
        return TooltipComponent
      },
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
       * config jexlFilters are deferred evaluated so they are prepended with
       * jexl at runtime rather than being stored with jexl in the config
       */
      get activeFilters() {
        return (
          self.jexlFilters ??
          getConf(self, 'jexlFilters').map((r: string) => `jexl:${r}`)
        )
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
      /**
       * #action
       */
      setJexlFilters(f?: string[]) {
        self.jexlFilters = cast(f)
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            config: self.rendererConfig,
            filters: new SerializableFilterChain({
              filters: self.activeFilters,
            }),
          }
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Edit filters',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  AddFiltersDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
      }
    })
}

export type LinearManhattanDisplayModel = ReturnType<typeof stateModelFactory>
