import Plugin from '@jbrowse/core/Plugin'

import GWASAdapterF from './GWASAdapter'
import GWASAddTrackComponentF from './GWASAddTrackComponent'
import GWASTrackF from './GWASTrack'
import GuessAdapterF from './GuessAdapter'
import LinearManhattanDisplayF from './LinearManhattanDisplay'
import JexlMouseoverF from './LinearManhattanDisplay/jexlMouseover'
import LinearManhattanRendererF from './LinearManhattanRenderer'
import { version } from './version'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GWASPlugin extends Plugin {
  name = 'GWASPlugin'
  version = version

  install(pluginManager: PluginManager) {
    GWASAdapterF(pluginManager)
    GWASAddTrackComponentF(pluginManager)
    GWASTrackF(pluginManager)
    GuessAdapterF(pluginManager)
    LinearManhattanDisplayF(pluginManager)
    LinearManhattanRendererF(pluginManager)
    JexlMouseoverF(pluginManager)
  }
}
