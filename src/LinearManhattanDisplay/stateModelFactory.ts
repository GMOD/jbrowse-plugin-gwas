import { lazy } from 'react'
import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { getNiceDomain } from '@jbrowse/plugin-wiggle'
import { autorun, observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent'

import type { ManhattanHit } from './findManhattanHit'
import type { ManhattanBackend, ManhattanRegionData, ManhattanRenderState } from './manhattanBackendTypes'
import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type WigglePlugin from '@jbrowse/plugin-wiggle'
import type * as d3scale from 'd3-scale'
import type * as mobx from 'mobx'
import type { ObservableMap } from 'mobx'

// avoid crazy typescript errors
export type { d3scale, mobx }

// FetchContext shape from MultiRegionDisplayMixin — inlined to avoid importing
// from @jbrowse/plugin-linear-genome-view's internal modules.
interface FetchCtx {
  stopToken: StopToken
  isStale: () => boolean
}

// Duck-typed self for the GPU lifecycle actions.
interface GpuManhattanSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  manhattanRpcDataMap: ObservableMap<number, ManhattanRpcResult>
  renderBlocks: RenderBlock[]
  manhattanRenderState: ManhattanRenderState | undefined
  gpuProps(): { colorAbgr: number }
}

// Duck-typed self for the fetch actions.
interface FetchManhattanSelf extends IAnyStateTreeNode {
  adapterConfig: Record<string, unknown> | undefined
  fetchRegions(
    needed: { region: Region; displayedRegionIndex: number }[],
    work: (ctx: FetchCtx) => Promise<void>,
  ): Promise<void>
  setStatusMessage(msg?: string): void
  setManhattanRpcData(idx: number, data: ManhattanRpcResult): void
}

// Duck-typed self for the domain view.
interface DomainSelf extends IAnyStateTreeNode {
  manhattanRpcDataMap: ObservableMap<number, ManhattanRpcResult>
  minScoreConfig: number | undefined
  maxScoreConfig: number | undefined
  scaleType: string
  autoscaleType: string
}

function domainFromStats(
  scoreMin: number,
  scoreMax: number,
  scoreMean: number,
  scoreStdDev: number,
  autoscaleType: string,
  numStdDev: number,
): [number, number] {
  if (autoscaleType === 'localsd' || autoscaleType === 'globalsd') {
    return [
      scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
      scoreMean + numStdDev * scoreStdDev,
    ]
  }
  return [scoreMin, scoreMax]
}

const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))
const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent'),
)

function encodeRegion(data: ManhattanRpcResult, colorAbgr: number): ManhattanRegionData {
  return {
    positions: data.positions,
    scores: data.scores,
    colors: new Uint32Array(data.numFeatures).fill(colorAbgr),
    numFeatures: data.numFeatures,
  }
}

function installManhattanLifecycle(self: GpuManhattanSelf, backend: ManhattanBackend) {
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.installGpuDisplay<ManhattanBackend>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of self.manhattanRpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            // Per-key autorun: fires on new data (O(1)) or gpuProps change
            // (O(N)). See ARCHITECTURE.md per-region streamed pattern.
            autorun(() => {
              const data = self.manhattanRpcDataMap.get(key)
              const { colorAbgr } = self.gpuProps()
              const bCurrent = self.currentGpuBackend as ManhattanBackend | undefined
              if (data !== undefined && bCurrent !== undefined) {
                bCurrent.uploadRegion(key, encodeRegion(data, colorAbgr))
                self.renderNow()
              }
            }),
          )
        }
      }
      const activeSet = new Set(active)
      for (const [key, dispose] of perKeyDisposers) {
        if (!activeSet.has(key)) {
          dispose()
          perKeyDisposers.delete(key)
        }
      }
      b.pruneRegions(active)
    },
    render: b => {
      const state = self.manhattanRenderState
      if (!state) {
        return false
      }
      return b.renderBlocks(self.renderBlocks, state)
    },
  })
}

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
    .volatile(() => ({
      manhattanRpcDataMap: observable.map<number, ManhattanRpcResult>(),
      manhattanFeatureUnderMouse: undefined as ManhattanHit | undefined,
    }))
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
      get DisplayMessageComponent(): React.ComponentType<any> {
        return LinearManhattanDisplayComponent
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
    .views(self => ({
      /**
       * #getter
       * Overrides wiggle's domain — derived from GWAS score min/max.
       * rpcDataMap is never populated so we must not read it for domain.
       */
      get domain() {
        const s = self as unknown as DomainSelf
        if (s.manhattanRpcDataMap.size === 0) {
          return undefined
        }
        let scoreMin = Infinity
        let scoreMax = -Infinity
        let scoreSum = 0
        let scoreSumSq = 0
        let n = 0
        for (const d of s.manhattanRpcDataMap.values()) {
          if (d.scoreMin < scoreMin) {
            scoreMin = d.scoreMin
          }
          if (d.scoreMax > scoreMax) {
            scoreMax = d.scoreMax
          }
          scoreSum += d.scoreSum
          scoreSumSq += d.scoreSumSq
          n += d.numFeatures
        }
        if (scoreMin > scoreMax || n === 0) {
          return undefined
        }
        const scoreMean = scoreSum / n
        const scoreStdDev = Math.sqrt(Math.max(0, scoreSumSq / n - scoreMean * scoreMean))
        const numStdDev = getConf(self, 'numStdDev') as number
        return getNiceDomain({
          domain: domainFromStats(scoreMin, scoreMax, scoreMean, scoreStdDev, s.autoscaleType, numStdDev),
          bounds: [s.minScoreConfig, s.maxScoreConfig] as const,
          scaleType: s.scaleType,
        })
      },

      /**
       * #method
       * Returns only GPU-encoding params. Color changes re-upload without
       * a new RPC fetch. See ARCHITECTURE.md rpcProps/gpuProps pattern.
       */
      gpuProps() {
        return {
          colorAbgr: cssColorToABGR(
            getConf(self, ['renderers', 'LinearManhattanRenderer', 'color']) as string,
          ),
        }
      },

      /**
       * #method
       * GWAS data is zoom-independent — override wiggle's rpcProps so
       * changes to wiggle-only settings (bicolorPivot, resolution) do
       * not trigger unnecessary refetches.
       */
      rpcProps() {
        return {}
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get manhattanRenderState(): ManhattanRenderState | undefined {
        const domain = self.domain
        if (!domain) {
          return undefined
        }
        const view = getContainingView(self) as unknown as { trackWidthPx: number }
        return {
          domainY: domain as unknown as [number, number],
          scaleType: self.scaleType === 'log' ? 1 : 0,
          canvasWidth: view.trackWidthPx,
          canvasHeight: self.height - 10,
          pointRadius: 2,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setManhattanRpcData(displayedRegionIndex: number, data: ManhattanRpcResult) {
        self.manhattanRpcDataMap.set(displayedRegionIndex, data)
      },

      setManhattanFeatureUnderMouse(hit: ManhattanHit | undefined) {
        self.manhattanFeatureUnderMouse = hit
      },

      clearDisplaySpecificData() {
        self.manhattanRpcDataMap.clear()
      },

      /**
       * #action
       * GWAS data doesn't vary with bpPerPx (unlike BigWig zoom levels).
       * Always return true so zooming does not discard loaded data.
       */
      isCacheValid(_displayedRegionIndex: number) {
        return true
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const s = self as unknown as FetchManhattanSelf
        const { adapterConfig } = s
        if (!adapterConfig) {
          return
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await s.fetchRegions(needed, async ctx => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'RenderManhattanData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  stopToken: ctx.stopToken,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      s.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                s.setManhattanRpcData(
                  r.displayedRegionIndex,
                  result as ManhattanRpcResult,
                )
              }
            }),
          )
        })
      },
      /**
       * #action
       * Opens the feature detail widget instead of popping a default dialog.
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
      /**
       * #action
       */
      startGpuBackendLifecycle(backend: ManhattanBackend) {
        installManhattanLifecycle(
          self as unknown as GpuManhattanSelf,
          backend,
        )
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
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
}

export type LinearManhattanDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearManhattanDisplayModel = Instance<LinearManhattanDisplayStateModel>
