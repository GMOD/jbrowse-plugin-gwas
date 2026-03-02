import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type LGVPlugin from '@jbrowse/plugin-linear-genome-view'

export function configSchemaFactory(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LGVPlugin
  const { baseLinearDisplayConfigSchema } = LGVPlugin.exports

  const LinearManhattanRendererConfigSchema = pluginManager.getRendererType(
    'LinearManhattanRenderer',
  )!.configSchema

  return ConfigurationSchema(
    'LinearVariantManhattanDisplay',
    {
      /**
       * #slot
       * The FORMAT field to use as the score for the Manhattan plot.
       * For GWAS-VCF files, this is typically 'LP' (-log10 p-value).
       */
      scoreField: {
        type: 'string',
        defaultValue: 'LP',
        description:
          'The VCF FORMAT field to use as the score (e.g., LP for -log10 p-value)',
      },
      /**
       * #slot
       * The sample ID to extract the score from. If empty, uses the first sample.
       */
      sampleId: {
        type: 'string',
        defaultValue: '',
        description:
          'The sample ID to extract the score from. Leave empty to use the first sample.',
      },
      mouseover: {
        type: 'string',
        defaultValue: 'jexl:getVariantManhattanTooltip(feature)',
        contextVariable: ['feature'],
      },
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      },
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      },
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']),
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },
      renderers: ConfigurationSchema('RenderersConfiguration', {
        LinearManhattanRenderer: LinearManhattanRendererConfigSchema,
      }),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
