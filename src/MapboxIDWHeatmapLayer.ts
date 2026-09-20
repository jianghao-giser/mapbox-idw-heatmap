import earcut from 'earcut';
import mapboxgl, { CustomLayerInterface } from 'mapbox-gl';

// ============================================================================
// 类型定义
// ============================================================================

export type MapboxInterpolateHeatmapLayerOptions = {
  id: string;
  data: { lat: number; lon: number; val: number }[];
  framebufferFactor?: number;
  maxValue?: number;
  minValue?: number;
  opacity?: number;
  p?: number;
  aoi?: { lat: number; lon: number }[];
  valueToColor?: string;
  valueToColor4?: string;
  textureCoverSameAreaAsROI?: boolean;
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建并编译顶点着色器
 */
function createVertexShader(
  gl: WebGLRenderingContext,
  source: string,
): WebGLShader | undefined {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (vertexShader) return compileShader(gl, vertexShader, source);
}

/**
 * 创建并编译片段着色器
 */
function createFragmentShader(
  gl: WebGLRenderingContext,
  source: string,
): WebGLShader | undefined {
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (fragmentShader) return compileShader(gl, fragmentShader, source);
}

/**
 * 编译着色器
 */
function compileShader(
  gl: WebGLRenderingContext,
  shader: WebGLShader,
  source: string,
): WebGLShader | undefined {
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw gl.getShaderInfoLog(shader);
  }
  return shader;
}

/**
 * 创建并链接着色器程序
 */
function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (program) {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(program);
    }
  }
  return program;
}

// ============================================================================
// Shader 源码
// ============================================================================

/**
 * 绘制阶段 - 顶点着色器
 * 职责：将数据边界矩形的顶点转换到裁剪空间，并计算纹理坐标
 */
const DRAW_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_Position;  // 顶点位置（Mercator 坐标）
  uniform mat4 u_Matrix;      // Mapbox 投影矩阵
  uniform vec4 u_DataBounds;  // 数据边界 (minX, minY, maxX, maxY)
  varying vec2 v_TexCoord;    // 传递给片元的纹理坐标 [0,1]
  
  void main() {
      gl_Position = u_Matrix * vec4(a_Position, 0.0, 1.0);
      
      // 计算当前顶点在数据边界矩形中的归一化位置 [0,1]
      // a_Position 是数据边界的顶点 (minX,minY) 到 (maxX,maxY)
      // 映射到纹理坐标 [0,0] 到 [1,1]
      v_TexCoord = (a_Position - u_DataBounds.xy) / (u_DataBounds.zw - u_DataBounds.xy);
  }
`;

/**
 * 绘制阶段 - 片段着色器（模板，需要注入颜色映射函数）
 * 职责：从计算纹理采样 IDW 结果，应用颜色映射
 */
function createDrawFragmentShader(valueToColor: string, valueToColor4: string): string {
  return `
    precision highp float;
    ${valueToColor}
    ${valueToColor4}
    uniform sampler2D u_ComputationTexture;
    varying vec2 v_TexCoord;     // 从顶点着色器插值得到的纹理坐标 [0,1]
    uniform float u_Opacity;
    
    void main(void) {
        // 修复：使用插值后的纹理坐标直接采样计算纹理
        // v_TexCoord 已经是 [0,1] 范围，对应数据边界矩形
        vec4 data = texture2D(u_ComputationTexture, v_TexCoord);
        
        if (data.y < 1e-20) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        
        // 数值溢出检测：放宽检测范围到 1e8（考虑 100 个点，每个权重 1e6）
        if (!(data.x >= -1e10 && data.x <= 1e10) || 
            !(data.y >= -1e10 && data.y <= 1e10)) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        
        float u = data.x / data.y;
        u = clamp(u, 0.0, 1.0);
        
        gl_FragColor = valueToColor4(u, u_Opacity);
    }
  `;
}

/**
 * 计算阶段 - 顶点着色器
 * 职责：为每个数据点设置计算区域（可以是全屏或数据边界）
 */
const COMPUTATION_VERTEX_SHADER = `
  precision highp float;
  uniform mat4 u_Matrix;
  uniform vec2 xi;            // 当前数据点坐标（Mercator）
  varying vec2 xiMercator;
  attribute vec2 a_Position;
  
  void main() {
      xiMercator = xi;
      gl_Position = u_Matrix * vec4(a_Position, 0.0, 1.0);
  }
`;

/**
 * 计算阶段 - 片段着色器
 * 职责：对每个像素计算当前数据点的 IDW 权重贡献
 */
const COMPUTATION_FRAGMENT_SHADER = `
  precision highp float;
  uniform float ui;                // 当前数据点的值（归一化）
  varying vec2 xiMercator;         // 当前数据点坐标
  uniform float p;                 // IDW 幂参数
  uniform vec2 u_FramebufferSize;
  uniform vec4 u_MercatorBounds;   // 数据边界 (minX, minY, maxX, maxY)
  
  void main() {
      // 将 framebuffer 像素坐标映射到 Mercator 空间
      vec2 pixelNormalized = vec2(
          gl_FragCoord.x / u_FramebufferSize.x,
          gl_FragCoord.y / u_FramebufferSize.y
      );
      
      vec2 xMercator = vec2(
          mix(u_MercatorBounds.x, u_MercatorBounds.z, pixelNormalized.x),
          mix(u_MercatorBounds.y, u_MercatorBounds.w, pixelNormalized.y)
      );
      
      // 在 Mercator 空间计算距离
      float dist = distance(xMercator, xiMercator);
      
      // 距离标准化
      vec2 boundsSize = u_MercatorBounds.zw - u_MercatorBounds.xy;
      float characteristicLength = length(boundsSize);
      float normalizedDist = dist / characteristicLength;
      
      // 数值稳定性处理
      // 策略：
      // 1. 设置权重上限为 1e6（单个点最大影响）
      // 2. 反推最小归一化距离，确保 wi 不超过上限
      // 3. minDist = (1 / maxWeight)^(1/p)
      float maxWeight = 1e6;
      float minDist = pow(1.0 / maxWeight, 1.0 / p);
      
      // 额外保护：不小于对角线的 0.001%（防止数值退化）
      minDist = max(minDist, 1e-5);
      
      normalizedDist = max(normalizedDist, minDist);
      
      // IDW 权重计算
      float wi = 1.0 / pow(normalizedDist, p);
      
      // 双重保护：即使计算有误差，也强制限制上限
      wi = min(wi, maxWeight);
      
      // 输出累加项
      gl_FragColor = vec4(ui * wi, wi, 0.0, 1.0);
  }
`;

// ============================================================================
// 主类
// ============================================================================

class MapboxInterpolateHeatmapLayer implements CustomLayerInterface {
  // --------------------------------------------------------------------------
  // Mapbox 接口必需属性
  // --------------------------------------------------------------------------
  id: string;
  type: 'custom' = 'custom' as const;
  renderingMode: '2d' | '3d' = '2d';
  
  // --------------------------------------------------------------------------
  // 配置参数
  // --------------------------------------------------------------------------
  private data: { lat: number; lon: number; val: number }[];
  private aoi?: { lat: number; lon: number }[];
  private framebufferFactor: number;
  private maxValue: number;
  private minValue: number;
  private opacity: number;
  private p: number;
  private valueToColor: string;
  private valueToColor4: string;
  private textureCoverSameAreaAsROI: boolean;
  
  // --------------------------------------------------------------------------
  // 处理后的数据
  // --------------------------------------------------------------------------
  private points: number[][] = [];  // [x_mercator, y_mercator, normalized_val]
  private mercatorBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  
  // --------------------------------------------------------------------------
  // WebGL 资源 - 计算阶段
  // --------------------------------------------------------------------------
  private computationProgram: WebGLProgram | null = null;
  private computationFramebuffer: WebGLFramebuffer | null = null;
  private computationTexture: WebGLTexture | null = null;
  private computationVerticesBuffer: WebGLBuffer | null = null;
  private aPositionComputation?: number;
  private uMatrixComputation: WebGLUniformLocation | null = null;
  private uUi: WebGLUniformLocation | null = null;
  private uXi: WebGLUniformLocation | null = null;
  private uP: WebGLUniformLocation | null = null;
  private uFramebufferSize: WebGLUniformLocation | null = null;
  private uMercatorBounds: WebGLUniformLocation | null = null;
  
  // --------------------------------------------------------------------------
  // WebGL 资源 - 绘制阶段
  // --------------------------------------------------------------------------
  private drawProgram: WebGLProgram | null = null;
  private drawingVerticesBuffer: WebGLBuffer | null = null;
  private aPositionDraw?: number;
  private uMatrixDraw: WebGLUniformLocation | null = null;
  private uComputationTexture: WebGLUniformLocation | null = null;
  private uDataBounds: WebGLUniformLocation | null = null;
  private uOpacity: WebGLUniformLocation | null = null;
  
  // --------------------------------------------------------------------------
  // WebGL 资源 - 共享
  // --------------------------------------------------------------------------
  private indicesBuffer: WebGLBuffer | null = null;
  private indicesNumber: number | null = null;
  private indexType: number = WebGLRenderingContext.UNSIGNED_BYTE;  // 索引类型
  private canvas?: HTMLCanvasElement;
  private framebufferWidth?: number;
  private framebufferHeight?: number;
  private resizeFramebuffer?: () => void;

  // ==========================================================================
  // 构造函数
  // ==========================================================================
  
  constructor(options: MapboxInterpolateHeatmapLayerOptions) {
    this.id = options.id || '';
    this.data = options.data || [];
    this.aoi = options.aoi || [];
    
    // 默认颜色映射（蓝→青→绿→黄→红）
    this.valueToColor = options.valueToColor || `
      vec3 valueToColor(float value) {
          return vec3(max((value-0.5)*2.0, 0.0), 
                      1.0 - 2.0*abs(value - 0.5), 
                      max((0.5-value)*2.0, 0.0));
      }
    `;
    this.valueToColor4 = options.valueToColor4 || `
      vec4 valueToColor4(float value, float defaultOpacity) {
          return vec4(valueToColor(value), defaultOpacity);
      }
    `;
    
    this.opacity = options.opacity || 0.5;
    this.minValue = options.minValue !== undefined ? options.minValue : 0;  // 默认为 0
    this.maxValue = options.maxValue !== undefined ? options.maxValue : 1;  // 默认为 1
    this.p = options.p || 2;
    this.framebufferFactor = options.framebufferFactor || 0.3;
    this.textureCoverSameAreaAsROI = this.framebufferFactor === 1;
  }

  // ==========================================================================
  // Mapbox 生命周期方法
  // ==========================================================================
  
  /**
   * 图层添加到地图时调用（一次性初始化）
   */
  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    this.canvas = map.getCanvas();
    
    // 1. 检查 WebGL 扩展
    this.checkWebGLExtensions(gl);
    
    // 2. 编译着色器程序
    this.initShaderPrograms(gl);
    
    // 3. 计算数据边界和顶点
    const drawingVertices = this.computeDrawingVertices();
    
    // 4. 创建 GPU 缓冲区
    this.initBuffers(gl, drawingVertices);
    
    // 5. 创建纹理和帧缓冲
    this.initFramebuffer(gl);
    
    // 6. 转换和归一化数据
    this.prepareData();
    
    // 7. 注册缩放回调
    this.resizeFramebuffer = () => this.handleResize(gl);
    map.on('resize', this.resizeFramebuffer);
  }
  
  /**
   * 图层从地图移除时调用（清理资源）
   */
  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    if (this.resizeFramebuffer) {
      map.off('resize', this.resizeFramebuffer);
    }
    
    // 清理 WebGL 资源
    gl.deleteTexture(this.computationTexture);
    gl.deleteBuffer(this.drawingVerticesBuffer);
    gl.deleteBuffer(this.computationVerticesBuffer);
    gl.deleteBuffer(this.indicesBuffer);
    gl.deleteFramebuffer(this.computationFramebuffer);
    gl.deleteProgram(this.computationProgram);
    gl.deleteProgram(this.drawProgram);
  }
  
  /**
   * 预渲染：计算 IDW 插值场（每帧）
   */
  prerender(gl: WebGLRenderingContext, matrix: number[]): void {
    if (!this.framebufferWidth || !this.framebufferHeight || 
        this.aPositionComputation === undefined || !this.indicesNumber) {
      throw new Error('error: missing options for prerendering');
    }
    
    console.log('=== prerender 开始 ===', {
      pointsCount: this.points.length,
      framebufferSize: [this.framebufferWidth, this.framebufferHeight],
      p: this.p
    });
    
    // 设置 WebGL 状态
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
    // 激活计算程序
    gl.useProgram(this.computationProgram);
    gl.uniformMatrix4fv(this.uMatrixComputation, false, matrix);
    gl.uniform1f(this.uP, this.p);
    gl.uniform2f(this.uFramebufferSize, this.framebufferWidth, this.framebufferHeight);
    
    // 传递 Mercator 边界
    if (this.mercatorBounds && this.uMercatorBounds) {
      console.log('传递 Mercator 边界:', this.mercatorBounds);
      gl.uniform4f(
        this.uMercatorBounds,
        this.mercatorBounds.minX,
        this.mercatorBounds.minY,
        this.mercatorBounds.maxX,
        this.mercatorBounds.maxY
      );
    }
    
    // 绑定帧缓冲
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
    gl.viewport(0, 0, this.framebufferWidth, this.framebufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    
    // 遍历每个数据点，累加其贡献
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      gl.uniform1f(this.uUi, point[2]);
      gl.uniform2f(this.uXi, point[0], point[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
      gl.enableVertexAttribArray(this.aPositionComputation);
      gl.vertexAttribPointer(this.aPositionComputation, 2, gl.FLOAT, false, 0, 0);
      
      if (this.textureCoverSameAreaAsROI) {
        gl.drawElements(gl.TRIANGLES, this.indicesNumber, this.indexType, 0);
      } else {
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    
    // 调试：读取中心像素
    const centerX = Math.floor(this.framebufferWidth / 2);
    const centerY = Math.floor(this.framebufferHeight / 2);
    const pixel = new Float32Array(4);
    gl.readPixels(centerX, centerY, 1, 1, gl.RGBA, gl.FLOAT, pixel);
    console.log(`中心像素 (${centerX}, ${centerY}):`, {
      weightedSum: pixel[0],
      totalWeight: pixel[1],
      interpolated: pixel[1] > 0 ? pixel[0] / pixel[1] : 0
    });
    
    // 恢复默认帧缓冲
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    
    console.log('=== prerender 完成 ===');
  }
  
  /**
   * 渲染：将 IDW 结果绘制到屏幕（每帧）
   */
  render(gl: WebGLRenderingContext, matrix: number[]): void {
    if (this.aPositionDraw === undefined || !this.canvas || !this.indicesNumber) {
      throw new Error('error: missing options for rendering');
    }
    
    console.log('=== render 开始 ===', {
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height
    });
    
    gl.useProgram(this.drawProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
    gl.enableVertexAttribArray(this.aPositionDraw);
    gl.vertexAttribPointer(this.aPositionDraw, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.uMatrixDraw, false, matrix);
    
    // 绑定计算纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
    gl.uniform1i(this.uComputationTexture, 0);
    
    // 传递数据边界到着色器
    if (this.mercatorBounds && this.uDataBounds) {
      console.log('传递数据边界到绘制着色器:', this.mercatorBounds);
      gl.uniform4f(
        this.uDataBounds,
        this.mercatorBounds.minX,
        this.mercatorBounds.minY,
        this.mercatorBounds.maxX,
        this.mercatorBounds.maxY
      );
    } else {
      console.error('数据边界未设置！', {
        hasBounds: !!this.mercatorBounds,
        hasUniform: !!this.uDataBounds
      });
    }
    
    gl.uniform1f(this.uOpacity, this.opacity);
    
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    gl.drawElements(gl.TRIANGLES, this.indicesNumber, this.indexType, 0);
    
    console.log('=== render 完成 ===');
  }

  // ==========================================================================
  // 私有初始化方法
  // ==========================================================================
  
  private checkWebGLExtensions(gl: WebGLRenderingContext): void {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && 
                     gl instanceof WebGL2RenderingContext;
    
    if (isWebGL2) {
      if (!gl.getExtension('EXT_color_buffer_float') || 
          !gl.getExtension('EXT_float_blend')) {
        throw new Error('WebGL2 extensions not supported');
      }
    } else {
      if (!gl.getExtension('OES_texture_float') || 
          !gl.getExtension('WEBGL_color_buffer_float') || 
          !gl.getExtension('EXT_float_blend')) {
        throw new Error('WebGL extensions not supported');
      }
    }
  }
  
  private initShaderPrograms(gl: WebGLRenderingContext): void {
    // 编译计算着色器
    const compVS = createVertexShader(gl, COMPUTATION_VERTEX_SHADER);
    const compFS = createFragmentShader(gl, COMPUTATION_FRAGMENT_SHADER);
    if (!compVS || !compFS) throw new Error('Computation shader compilation failed');
    
    this.computationProgram = createProgram(gl, compVS, compFS);
    if (!this.computationProgram) throw new Error('Computation program creation failed');
    
    // 获取计算程序的 locations
    this.aPositionComputation = gl.getAttribLocation(this.computationProgram, 'a_Position');
    this.uMatrixComputation = gl.getUniformLocation(this.computationProgram, 'u_Matrix');
    this.uUi = gl.getUniformLocation(this.computationProgram, 'ui');
    this.uXi = gl.getUniformLocation(this.computationProgram, 'xi');
    this.uP = gl.getUniformLocation(this.computationProgram, 'p');
    this.uFramebufferSize = gl.getUniformLocation(this.computationProgram, 'u_FramebufferSize');
    this.uMercatorBounds = gl.getUniformLocation(this.computationProgram, 'u_MercatorBounds');
    
    console.log('✓ 计算着色器编译完成');
    
    // 编译绘制着色器
    const drawVS = createVertexShader(gl, DRAW_VERTEX_SHADER);
    const drawFS = createFragmentShader(gl, createDrawFragmentShader(this.valueToColor, this.valueToColor4));
    if (!drawVS || !drawFS) throw new Error('Draw shader compilation failed');
    
    this.drawProgram = createProgram(gl, drawVS, drawFS);
    if (!this.drawProgram) throw new Error('Draw program creation failed');
    
    // 获取绘制程序的 locations
    this.aPositionDraw = gl.getAttribLocation(this.drawProgram, 'a_Position');
    this.uMatrixDraw = gl.getUniformLocation(this.drawProgram, 'u_Matrix');
    this.uComputationTexture = gl.getUniformLocation(this.drawProgram, 'u_ComputationTexture');
    this.uDataBounds = gl.getUniformLocation(this.drawProgram, 'u_DataBounds');
    this.uOpacity = gl.getUniformLocation(this.drawProgram, 'u_Opacity');
    
    console.log('✓ 绘制着色器编译完成');
  }
  
  private computeDrawingVertices(): number[] {
    const drawingVertices: number[] = [];
    
    if (!this.aoi || this.aoi.length === 0) {
      // 没有 AOI，根据数据点计算边界
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      this.data.forEach((rawPoint) => {
        const coords = mapboxgl.MercatorCoordinate.fromLngLat(rawPoint);
        minX = Math.min(minX, coords.x);
        maxX = Math.max(maxX, coords.x);
        minY = Math.min(minY, coords.y);
        maxY = Math.max(maxY, coords.y);
      });
      
      // 扩展 10% 边距
      const rangeX = maxX - minX;
      const rangeY = maxY - minY;
      const padding = 0.1;
      minX -= rangeX * padding;
      maxX += rangeX * padding;
      minY -= rangeY * padding;
      maxY += rangeY * padding;
      
      this.mercatorBounds = { minX, maxX, minY, maxY };
      console.log('✓ 自动计算数据边界:', this.mercatorBounds);
      
      // 矩形顶点（逆时针）
      drawingVertices.push(minX, minY, minX, maxY, maxX, maxY, maxX, minY);
    } else {
      // 使用 AOI
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      this.aoi.forEach((aoi) => {
        const coords = mapboxgl.MercatorCoordinate.fromLngLat(aoi);
        drawingVertices.push(coords.x, coords.y);
        minX = Math.min(minX, coords.x);
        maxX = Math.max(maxX, coords.x);
        minY = Math.min(minY, coords.y);
        maxY = Math.max(maxY, coords.y);
      });
      
      this.mercatorBounds = { minX, maxX, minY, maxY };
      console.log('✓ 使用 AOI 边界:', this.mercatorBounds);
    }
    
    return drawingVertices;
  }
  
  private initBuffers(gl: WebGLRenderingContext, drawingVertices: number[]): void {
    // 绘制顶点缓冲
    this.drawingVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(drawingVertices), gl.STATIC_DRAW);
    
    // 计算顶点缓冲（全屏或数据边界）
    const computationVertices = this.textureCoverSameAreaAsROI
      ? drawingVertices
      : [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
    this.computationVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(computationVertices), gl.STATIC_DRAW);
    
    // 索引缓冲（用于三角化多边形）
    const indices = earcut(drawingVertices);
    this.indicesBuffer = gl.createBuffer();
    this.indicesNumber = indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    
    // 根据顶点数量选择合适的索引类型
    // 超过 256 个顶点时需要使用 Uint16Array
    const vertexCount = drawingVertices.length / 2;
    if (vertexCount > 256) {
      console.log(`✓ 使用 Uint16Array (顶点数: ${vertexCount}, 索引数: ${indices.length})`);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      this.indexType = gl.UNSIGNED_SHORT;
    } else {
      console.log(`✓ 使用 Uint8Array (顶点数: ${vertexCount}, 索引数: ${indices.length})`);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);
      this.indexType = gl.UNSIGNED_BYTE;
    }
    
    console.log('✓ GPU 缓冲区创建完成');
  }
  
  private initFramebuffer(gl: WebGLRenderingContext): void {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && 
                     gl instanceof WebGL2RenderingContext;
    
    this.framebufferWidth = Math.ceil(this.canvas!.width * this.framebufferFactor);
    this.framebufferHeight = Math.ceil(this.canvas!.height * this.framebufferFactor);
    
    // 创建浮点纹理
    this.computationTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    
    if (isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA32F, 
                     this.framebufferWidth, this.framebufferHeight, 
                     0, gl2.RGBA, gl2.FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
                    this.framebufferWidth, this.framebufferHeight, 
                    0, gl.RGBA, gl.FLOAT, null);
    }
    
    // 创建帧缓冲并绑定纹理
    this.computationFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                            gl.TEXTURE_2D, this.computationTexture, 0);
    
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer 不完整:', status);
    }
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    console.log('✓ 帧缓冲创建完成:', {
      width: this.framebufferWidth,
      height: this.framebufferHeight
    });
  }
  
  private prepareData(): void {
    this.points = [];
    let actualMinValue = Infinity;
    let actualMaxValue = -Infinity;
    
    // 转换为 Mercator 坐标并统计实际数据范围
    this.data.forEach((rawPoint) => {
      const coords = mapboxgl.MercatorCoordinate.fromLngLat(rawPoint);
      this.points.push([coords.x, coords.y, rawPoint.val]);
      actualMinValue = Math.min(actualMinValue, rawPoint.val);
      actualMaxValue = Math.max(actualMaxValue, rawPoint.val);
    });
    
    // 使用传入的参数作为归一化范围（而不是实际数据范围）
    // 这样可以保持颜色映射在不同时刻的一致性
    const normMinValue = this.minValue;  // 通常为 0
    const normMaxValue = this.maxValue;  // 通常为全局最大雨量值
    
    console.log('✓ 数据统计:', {
      dataPoints: this.data.length,
      actualMinValue,              // 当前时刻实际最小值
      actualMaxValue,              // 当前时刻实际最大值
      normMinValue,                // 归一化使用的最小值（固定为0）
      normMaxValue,                // 归一化使用的最大值（全局最大值）
      samplePointBeforeNorm: [...this.points[0]]
    });
    
    // 归一化到 [0, 1]，使用 [normMinValue, normMaxValue] 作为归一化范围
    // 由于 normMinValue = 0，公式简化为: normalized = value / normMaxValue
    this.points.forEach((point) => {
      point[2] = (point[2] - normMinValue) / (normMaxValue - normMinValue);
    });
    
    console.log('✓ 数据归一化完成，示例:', this.points[0]);
    console.log(`  归一化公式: (value - ${normMinValue.toFixed(4)}) / ${(normMaxValue - normMinValue).toFixed(4)}`);
    console.log(`  简化公式: value / ${normMaxValue.toFixed(4)}`);
  }
  
  private handleResize(gl: WebGLRenderingContext): void {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && 
                     gl instanceof WebGL2RenderingContext;
    
    this.framebufferWidth = Math.ceil(this.canvas!.width * this.framebufferFactor);
    this.framebufferHeight = Math.ceil(this.canvas!.height * this.framebufferFactor);
    
    gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
    
    if (isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA32F,
                     this.framebufferWidth, this.framebufferHeight,
                     0, gl2.RGBA, gl2.FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    this.framebufferWidth, this.framebufferHeight,
                    0, gl.RGBA, gl.FLOAT, null);
    }
  }
}

export { MapboxInterpolateHeatmapLayer };
