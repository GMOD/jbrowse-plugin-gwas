import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchemaFactory'
import { stateModelFactory } from './stateModelFactory'

import type PluginManager from '@jbrowse/core/PluginManager'
import type WigglePlugin from '@jbrowse/plugin-wiggle'

export default function LinearVariantManhattanDisplayF(
  pluginManager: PluginManager,
) {
  const WigglePlugin = pluginManager.getPlugin('WigglePlugin') as WigglePlugin

  const { LinearWiggleDisplayReactComponent } = WigglePlugin.exports

  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearVariantManhattanDisplay',
      configSchema,
      stateModel: stateModelFactory(pluginManager, configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
