import Plugin from '@jbrowse/core/Plugin'

import GWASAdapterF from './GWASAdapter'
import GWASAddTrackComponentF from './GWASAddTrackComponent'
import GWASTrackF from './GWASTrack'
import GWASVcfAdapterF from './GWASVcfAdapter'
import GuessAdapterF from './GuessAdapter'
import LinearManhattanDisplayF from './LinearManhattanDisplay'
import LinearVariantManhattanDisplayF from './LinearVariantManhattanDisplay'
import JexlMouseoverF from './LinearManhattanDisplay/jexlMouseover'
import JexlVariantMouseoverF from './LinearVariantManhattanDisplay/jexlMouseover'
import LinearManhattanRendererF from './LinearManhattanRenderer'
import { version } from '../package.json'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GWASPlugin extends Plugin {
  name = 'GWASPlugin'
  version = version

  install(pluginManager: PluginManager) {
    GWASAdapterF(pluginManager)
    GWASAddTrackComponentF(pluginManager)
    GWASTrackF(pluginManager)
    GWASVcfAdapterF(pluginManager)
    GuessAdapterF(pluginManager)
    LinearManhattanDisplayF(pluginManager)
    LinearVariantManhattanDisplayF(pluginManager)
    LinearManhattanRendererF(pluginManager)
    JexlMouseoverF(pluginManager)
    JexlVariantMouseoverF(pluginManager)
  }
}
