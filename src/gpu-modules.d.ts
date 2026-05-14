// Ambient declarations for @jbrowse/core GPU modules not yet in the published
// package. Remove this file once @jbrowse/core with GPU support is published.

declare module '@jbrowse/core/gpu/hal' {
  export interface GlAttributeLayout {
    name: string
    components: number
    type: 'float' | 'uint' | 'int'
    offsetBytes: number
    integer: boolean
  }

  export interface TextureBinding {
    textureBinding: number
    samplerBinding: number
    glTextureUnit: number
    glUniformName: string
    filter: 'linear' | 'nearest'
  }

  export interface BlendState {
    srcFactor: 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'zero'
    dstFactor: 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'zero'
  }

  export interface PassDescriptor {
    id: string
    wgslSource: string
    glslVertex: string
    glslFragment: string
    instanceStride: number
    verticesPerInstance: number
    blend: boolean
    blendState?: BlendState
    glAttributes: readonly GlAttributeLayout[]
    wgslFragmentEntry?: string
    glslFragmentOverride?: string
    topology?: 'triangle-list' | 'triangle-strip' | 'line-list'
    textures?: readonly TextureBinding[]
  }

  export interface RegionMeta {
    regionStart: number
    maxDepth: number
  }

  export interface GpuHal {
    resize(width: number, height: number): void
    uploadBuffer(
      regionKey: number,
      passId: string,
      data: ArrayBuffer | ArrayBufferView,
      count: number,
    ): void
    setRegionMeta(regionKey: number, meta: Partial<RegionMeta>): void
    getRegionMeta(regionKey: number): RegionMeta | undefined
    getBufferCount(regionKey: number, passId: string): number
    deleteBuffer(regionKey: number, passId: string): void
    deleteRegion(regionKey: number): void
    deleteAllRegions(): void
    uploadTexture(passId: string, data: Uint8Array, width: number, height: number): void
    writeUniforms(data: ArrayBuffer): void
    beginFrame(clearR: number, clearG: number, clearB: number, clearA?: number): void
    drawPass(passId: string, regionKey: number, bufferPassId?: string): void
    endFrame(): void
    setScissor(x: number, y: number, w: number, h: number): void
    clearScissor(): void
    setViewport(x: number, y: number, w: number, h: number): void
    clearViewport(): void
    dispose(): void
  }
}

declare module '@jbrowse/core/gpu/renderBlock' {
  export interface RenderBlock {
    displayedRegionIndex: number
    bpRangeX: [number, number]
    screenStartPx: number
    screenEndPx: number
    reversed: boolean
  }

  export function buildRenderBlocks(
    regions: {
      displayedRegionIndex: number
      start: number
      end: number
      screenStartPx: number
      screenEndPx: number
      reversed?: boolean
    }[],
  ): RenderBlock[]
}

declare module '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin' {
  export interface InstallGpuDisplayCallbacks<B> {
    upload: (backend: B) => void
    render: (backend: B) => boolean
  }
}

declare module '@jbrowse/core/gpu/blockClipUtils' {
  import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

  export interface ClipResult {
    pxX: number
    pxW: number
    pxH: number
    bpRangeHi: number
    bpRangeLo: number
    bpRangeSpan: number
    hpZero: number
  }

  export function clipBlock(
    block: RenderBlock,
    canvasWidth: number,
    canvasHeight: number,
    dpr: number,
  ): ClipResult | undefined

  export function writeBpRangeUniforms(
    f32: Float32Array,
    clip: ClipResult,
    reversed: boolean,
  ): void
}

declare module '@jbrowse/core/gpu/canvas2dUtils' {
  export function getDpr(): number
  export function prepareCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void
}

declare module '@jbrowse/core/gpu/pruneRegionMap' {
  export function pruneRegionMap<T>(
    map: Map<number, T>,
    activeRegions: number[],
    onDelete: (key: number) => void,
  ): void
}

declare module '@jbrowse/core/gpu/slangPass' {
  import type { GlAttributeLayout, PassDescriptor } from '@jbrowse/core/gpu/hal'

  export interface SlangPassModule {
    WGSL_SOURCE: string
    GLSL_VERTEX: string
    GLSL_FRAGMENT: string
    VERTS_PER_INSTANCE: number
    UNIFORMS_SIZE_BYTES: number
    INSTANCE_STRIDE_BYTES: number
    GL_ATTRIBUTES: readonly GlAttributeLayout[]
  }

  export interface SlangPassOpts {
    id: string
    mod: SlangPassModule
    topology?: PassDescriptor['topology']
    blend?: boolean
  }

  export function slangPass(opts: SlangPassOpts): PassDescriptor
}

declare module '@jbrowse/core/gpu/createDualRenderer' {
  import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

  export function initDualBackend<TBackend>(
    canvas: HTMLCanvasElement,
    passes: PassDescriptor[],
    uniformByteSize: number,
    createGpuBackend: (hal: GpuHal) => TBackend,
    createCanvas2DBackend: (canvas: HTMLCanvasElement) => TBackend,
  ): Promise<TBackend>
}

declare module '@jbrowse/core/util/colorBits' {
  export function cssColorToABGR(color: string): number
  export function abgrToCssRgba(c: number): string
  export function abgrRed(c: number): number
  export function abgrGreen(c: number): number
  export function abgrBlue(c: number): number
  export function abgrAlpha(c: number): number
}

declare module '@jbrowse/core/util/useGpuModelLifecycle' {
  export interface GpuLifecycleModel<BackendType> {
    startGpuBackendLifecycle: (backend: BackendType) => void
    stopGpuBackendLifecycle: () => void
    renderNow: () => void
  }

  export function useGpuModelLifecycle<BackendType extends { dispose(): void }>(
    factory: (canvas: HTMLCanvasElement) => Promise<BackendType>,
    model: GpuLifecycleModel<BackendType>,
  ): { canvas: HTMLCanvasElement | null; canvasRef: React.RefCallback<HTMLCanvasElement>; error: unknown; retry: () => void }
}

