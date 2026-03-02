import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const configSchema = ConfigurationSchema(
  'GWASVcfAdapter',
  {
    /**
     * #slot
     */
    subadapter: {
      type: 'frozen',
      description: 'The underlying VCF adapter configuration',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)
