import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import GWASVcfAdapter from './GWASVcfAdapter'
import { configSchema } from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASVcfAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GWASVcfAdapter',
        displayName: 'GWAS VCF adapter',
        configSchema,
        getAdapterClass: async () => GWASVcfAdapter,
      }),
  )
}
