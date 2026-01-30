import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

function toP(s = 0) {
  return +s.toPrecision(6)
}

const en = (n: number) => n.toLocaleString('en-US')

function getVariantManhattanTooltip(feature: Feature) {
  const start = feature.get('start') + 1
  const end = feature.get('end')
  const refName = feature.get('refName')
  const id = feature.get('id') || feature.get('name')
  const ref = feature.get('REF')
  const alt = feature.get('ALT')
  const loc = [refName, start === end ? en(start) : `${en(start)}..${en(end)}`]
    .filter(f => !!f)
    .join(':')

  const samples = feature.get('samples') as
    | Record<string, Record<string, unknown[]>>
    | undefined
  const lines = [`${loc}`]

  if (id) {
    lines.push(`ID: ${id}`)
  }
  if (ref && alt) {
    const altStr = Array.isArray(alt) ? alt.join(',') : alt
    lines.push(`${ref}>${altStr}`)
  }

  if (samples) {
    const sampleIds = Object.keys(samples)
    const firstSample = sampleIds[0]
    if (firstSample) {
      const sampleData = samples[firstSample]
      if (sampleData) {
        const lp = sampleData.LP
        const es = sampleData.ES
        const se = sampleData.SE
        if (lp !== undefined) {
          const lpVal = Array.isArray(lp) ? lp[0] : lp
          lines.push(`-log10(p): ${toP(Number(lpVal))}`)
        }
        if (es !== undefined) {
          const esVal = Array.isArray(es) ? es[0] : es
          lines.push(`Effect size: ${toP(Number(esVal))}`)
        }
        if (se !== undefined) {
          const seVal = Array.isArray(se) ? se[0] : se
          lines.push(`Std error: ${toP(Number(seVal))}`)
        }
      }
    }
  }

  return lines.join('<br/>')
}

export default function JexlVariantMouseoverF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction(
    'getVariantManhattanTooltip',
    (feature: Feature) => getVariantManhattanTooltip(feature),
  )
}
