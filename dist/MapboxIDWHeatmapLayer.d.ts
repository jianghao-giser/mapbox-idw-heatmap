import { CustomLayerInterface } from 'mapbox-gl';
export type MapboxInterpolateHeatmapLayerOptions = {
    id: string;
    data: {
        lat: number;
        lon: number;
        val: number;
    }[];
    framebufferFactor?: number;
    maxValue?: number;
    minValue?: number;
    opacity?: number;
    p?: number;
    aoi?: {
        lat: number;
        lon: number;
    }[];
    valueToColor?: string;
    valueToColor4?: string;
    textureCoverSameAreaAsROI?: boolean;
};
declare class MapboxInterpolateHeatmapLayer implements CustomLayerInterface {
    id: string;
    type: 'custom';
    renderingMode: '2d' | '3d';
    private data;
    private aoi?;
    private framebufferFactor;
    private maxValue;
    private minValue;
    private opacity;
    private p;
    private valueToColor;
    private valueToColor4;
    private textureCoverSameAreaAsROI;
    private points;
    private mercatorBounds?;
    private computationProgram;
    private computationFramebuffer;
    private computationTexture;
    private computationVerticesBuffer;
    private aPositionComputation?;
    private uMatrixComputation;
    private uUi;
    private uXi;
    private uP;
    private uFramebufferSize;
    private uMercatorBounds;
    private drawProgram;
    private drawingVerticesBuffer;
    private aPositionDraw?;
    private uMatrixDraw;
    private uComputationTexture;
    private uDataBounds;
    private uOpacity;
    private indicesBuffer;
    private indicesNumber;
    private indexType;
    private canvas?;
    private framebufferWidth?;
    private framebufferHeight?;
    private resizeFramebuffer?;
    constructor(options: MapboxInterpolateHeatmapLayerOptions);
    /**
     * 图层添加到地图时调用（一次性初始化）
     */
    onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
    /**
     * 图层从地图移除时调用（清理资源）
     */
    onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
    /**
     * 预渲染：计算 IDW 插值场（每帧）
     */
    prerender(gl: WebGLRenderingContext, matrix: number[]): void;
    /**
     * 渲染：将 IDW 结果绘制到屏幕（每帧）
     */
    render(gl: WebGLRenderingContext, matrix: number[]): void;
    private checkWebGLExtensions;
    private initShaderPrograms;
    private computeDrawingVertices;
    private initBuffers;
    private initFramebuffer;
    private prepareData;
    private handleResize;
}
export { MapboxInterpolateHeatmapLayer };
//# sourceMappingURL=MapboxIDWHeatmapLayer.d.ts.map