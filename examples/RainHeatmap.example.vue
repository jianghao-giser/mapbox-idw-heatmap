<template>
  <div class="rain-heatmap-container">
    <div ref="mapContainer" class="map-container"></div>
    
    <!-- 时间控制条 -->
    <div class="time-slider-container">
      <div class="time-slider-header">
        <span class="time-label">{{ currentTimeDisplay }}</span>
        <div class="playback-controls">
          <button @click="togglePlayback" :class="['play-btn', { playing: isPlaying }]">
            {{ isPlaying ? '⏸' : '▶' }}
          </button>
          <button @click="resetTime" class="reset-btn">⏮</button>
        </div>
      </div>
      <input 
        type="range" 
        v-model.number="timeIndex" 
        :min="0" 
        :max="timeOptions.length - 1" 
        :step="1"
        @input="onTimeChange"
        class="time-slider"
      />
      <div class="time-marks">
        <span>{{ timeOptions[0] }}</span>
        <span>{{ timeOptions[timeOptions.length - 1] }}</span>
      </div>
    </div>
    
    <!-- 参数控制面板 -->
    <div class="controls">
      <h3>热力图参数</h3>
      
      <div class="param-group">
        <label>
          <span class="param-label">不透明度</span>
          <span class="param-value">{{ opacity.toFixed(2) }}</span>
        </label>
        <input 
          type="range" 
          v-model.number="opacity" 
          min="0" 
          max="1" 
          step="0.05"
          @input="updateHeatmap"
        />
      </div>
      
      <div class="param-group">
        <label>
          <span class="param-label">IDW 幂参数 (p)</span>
          <span class="param-value">{{ idwPower }}</span>
        </label>
        <input 
          type="range" 
          v-model.number="idwPower" 
          min="1" 
          max="5" 
          step="0.5"
          @input="updateHeatmap"
        />
        <span class="param-hint">{{ getPowerHint(idwPower) }}</span>
      </div>
      
      <div class="param-group">
        <label>
          <span class="param-label">分辨率</span>
          <span class="param-value">{{ (framebufferFactor * 100).toFixed(0) }}%</span>
        </label>
        <input 
          type="range" 
          v-model.number="framebufferFactor" 
          min="0.2" 
          max="1" 
          step="0.1"
          @input="updateHeatmap"
        />
        <span class="param-hint">{{ getResolutionHint(framebufferFactor) }}</span>
      </div>
      
      <div class="param-group">
        <label>
          <span class="param-label">颜色方案</span>
        </label>
        <select v-model="colorScheme" @change="updateHeatmap" class="color-select">
          <option value="rainfall">降雨量分级 (专业)</option>
          <option value="rainbow">彩虹 (蓝→红)</option>
          <option value="heat">热力 (黑→红→黄)</option>
          <option value="cool">冷色 (蓝→青→白)</option>
          <option value="grayscale">灰度</option>
        </select>
      </div>
      
      <div class="param-group">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input 
            type="checkbox" 
            v-model="showSites" 
            @change="toggleSites"
            style="margin-right: 8px; cursor: pointer; width: 16px; height: 16px;"
          >
          <span class="param-label">显示站点位置</span>
        </label>
      </div>
      
      <div class="stats">
        <h4>数据统计</h4>
        <p>站点总数: <strong>{{ totalSites }}</strong></p>
        <p>有效数据: <strong>{{ validDataCount }}</strong></p>
        <p>雨量范围: <strong>0.00 ~ {{ maxRain.toFixed(2) }} mm</strong></p>
      </div>
      
      <!-- 色带图例 -->
      <div v-if="colorScheme === 'rainfall'" class="legend">
        <h4>降雨量分级</h4>
        <div class="legend-item" style="background: #ffffff; border: 1px solid #ddd; color: #666;">
          <span class="rain-level">无雨</span>
          <span class="rain-value">< 0.1 mm</span>
        </div>
        <div class="legend-item" style="background: #A6F28E;">
          <span class="rain-level">小雨</span>
          <span class="rain-value">0.1 - 4.9 mm</span>
        </div>
        <div class="legend-item" style="background: #3DB93D; color: white;">
          <span class="rain-level">中雨</span>
          <span class="rain-value">5 - 14.9 mm</span>
        </div>
        <div class="legend-item" style="background: #61B8FF;">
          <span class="rain-level">大雨</span>
          <span class="rain-value">15 - 29.9 mm</span>
        </div>
        <div class="legend-item" style="background: #0000FE; color: white;">
          <span class="rain-level">暴雨</span>
          <span class="rain-value">30 - 69.9 mm</span>
        </div>
        <div class="legend-item" style="background: #F900FD; color: white;">
          <span class="rain-level">大暴雨</span>
          <span class="rain-value">70 - 139.9 mm</span>
        </div>
        <div class="legend-item" style="background: #A80000; color: white;">
          <span class="rain-level">特大暴雨</span>
          <span class="rain-value">≥ 140 mm</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import mapboxgl from 'mapbox-gl';
import { MapboxInterpolateHeatmapLayer } from './layer-refactored';

// 导入数据
import sitesData from './data/sites.json';
import rainData from './data/rain.json';
import hainingData from './MapBox/haining.json';

// 天地图 Token
const TDT_TOKEN = 'df452eec3513f70c5223ff455151f7eb';

const mapContainer = ref<HTMLDivElement>();
let map: mapboxgl.Map | null = null;
let heatmapLayer: MapboxInterpolateHeatmapLayer | null = null;
let playbackTimer: number | null = null;

// 时间控制
// 找到 2026-08-14 19:00 的索引作为默认值
const defaultTime = '2026-08-14 19';
const defaultIndex = rainData.data.findIndex(item => item.dateTime === defaultTime);
const timeIndex = ref(defaultIndex >= 0 ? defaultIndex : 0);
const isPlaying = ref(false);

// 打印默认时间信息
console.log('=== 默认时间设置 ===');
console.log(`目标时间: ${defaultTime}`);
console.log(`找到索引: ${defaultIndex}`);
console.log(`总时间数: ${rainData.data.length}`);
console.log(`默认显示: ${rainData.data[timeIndex.value]?.dateTime || '未找到'}`);
console.log('==================\n');

// 热力图参数
const opacity = ref(0.6);
const idwPower = ref(2);
const framebufferFactor = ref(0.5);
const colorScheme = ref('rainfall');  // 默认使用降雨量专业配色
const showSites = ref(true);  // 是否显示站点

// 数据统计
const totalSites = ref(0);
const validDataCount = ref(0);
const minRain = ref(0);
const maxRain = ref(0);

// 提取所有时间选项
const timeOptions = computed(() => {
  return rainData.data.map(item => item.dateTime);
});

// 当前时间显示
const currentTimeDisplay = computed(() => {
  return timeOptions.value[timeIndex.value] || '';
});

// 从 haining.json 提取 AOI 坐标
const hainingAOI = computed(() => {
  const feature = (hainingData as any).features[0];
  if (!feature || !feature.geometry) return [];
  
  const coordinates = feature.geometry.coordinates;
  
  // MultiPolygon 结构: [Polygon1, Polygon2, ...]
  // 每个 Polygon: [[外环], [洞1], [洞2], ...]
  // 我们取第一个多边形的外环（最外层边界）
  if (!coordinates || coordinates.length === 0) return [];
  
  const firstPolygon = coordinates[0];  // 第一个 Polygon
  if (!firstPolygon || firstPolygon.length === 0) return [];
  
  const outerRing = firstPolygon[0];     // 外环（第一个环）
  
  console.log('MultiPolygon 结构检查:', {
    多边形数量: coordinates.length,
    第一个多边形的环数: firstPolygon.length,
    外环坐标点数: outerRing.length
  });
  
  // 转换为 {lon, lat} 格式
  return outerRing.map((coord: number[]) => ({
    lon: coord[0],
    lat: coord[1]
  }));
});

// 创建站点 ID 到坐标的映射
const siteCoordinates = computed(() => {
  const map = new Map();
  sitesData.data.forEach(site => {
    map.set(site.siteId, {
      lon: parseFloat(site.longitude),
      lat: parseFloat(site.latitude),
      name: site.siteName
    });
  });
  return map;
});

// 获取 IDW 幂参数提示
const getPowerHint = (p: number): string => {
  if (p <= 1.5) return '影响范围大，平滑';
  if (p <= 2.5) return '标准 IDW';
  if (p <= 3.5) return '影响范围小';
  return '局部化，尖锐';
};

// 获取分辨率提示
const getResolutionHint = (factor: number): string => {
  if (factor >= 0.8) return '高质量';
  if (factor >= 0.5) return '平衡';
  return '性能优先';
};

// 颜色方案映射
const getColorSchemeCode = (scheme: string, maxValue: number): string => {
  console.log(`=== 生成着色器颜色映射 ===`);
  console.log(`配色方案: ${scheme}, 最大值: ${maxValue.toFixed(4)} mm`);
  
  const schemes: Record<string, string> = {
    rainfall: `
      vec3 valueToColor(float value) {
        // 降雨量分级配色方案
        // value 是归一化值 [0, 1]
        // 反归一化为实际雨量值（mm），minValue 默认为 0
        float rain = value * ${maxValue.toFixed(2)};
        
        // 约束在合理范围内，避免插值外推
        rain = clamp(rain, 0.0, 200.0);
        
        if (rain < 0.1) {
          return vec3(1.0, 1.0, 1.0);  // < 0.1mm: 白色（透明）
        } else if (rain < 5.0) {
          return vec3(0.651, 0.949, 0.557);  // 0.1-4.9mm: 浅绿 #A6F28E
        } else if (rain < 15.0) {
          return vec3(0.239, 0.725, 0.239);  // 5-14.9mm: 深绿 #3DB93D
        } else if (rain < 30.0) {
          return vec3(0.380, 0.722, 1.0);  // 15-29.9mm: 浅蓝 #61B8FF
        } else if (rain < 70.0) {
          return vec3(0.0, 0.0, 0.996);  // 30-69.9mm: 深蓝 #0000FE
        } else if (rain < 140.0) {
          return vec3(0.976, 0.0, 0.992);  // 70-139.9mm: 紫红 #F900FD
        } else {
          return vec3(0.659, 0.0, 0.0);  // >= 140mm: 深红 #A80000
        }
      }
    `,
    rainbow: `
      vec3 valueToColor(float value) {
        if (value < 0.25) {
          return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), value * 4.0);
        } else if (value < 0.5) {
          return mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (value - 0.25) * 4.0);
        } else if (value < 0.75) {
          return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (value - 0.5) * 4.0);
        } else {
          return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (value - 0.75) * 4.0);
        }
      }
    `,
    heat: `
      vec3 valueToColor(float value) {
        if (value < 0.33) {
          return mix(vec3(0.0, 0.0, 0.0), vec3(0.5, 0.0, 0.0), value * 3.0);
        } else if (value < 0.66) {
          return mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 0.0, 0.0), (value - 0.33) * 3.0);
        } else {
          return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 0.0), (value - 0.66) * 3.0);
        }
      }
    `,
    cool: `
      vec3 valueToColor(float value) {
        if (value < 0.5) {
          return mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 0.5, 1.0), value * 2.0);
        } else {
          return mix(vec3(0.0, 0.5, 1.0), vec3(0.8, 1.0, 1.0), (value - 0.5) * 2.0);
        }
      }
    `,
    grayscale: `
      vec3 valueToColor(float value) {
        return vec3(value);
      }
    `
  };
  
  const shaderCode = schemes[scheme] || schemes.rainfall;
  
  // 打印完整的着色器代码用于调试
  console.log('\n生成的着色器代码:');
  console.log(shaderCode);
  console.log('=== 着色器代码结束 ===\n');
  
  return shaderCode;
};

// 根据选中的时间段，合并站点坐标和雨量数据
const prepareHeatmapData = (dateTime: string) => {
  const timeData = rainData.data.find(item => item.dateTime === dateTime);
  if (!timeData) return [];
  
  const data: { lon: number; lat: number; val: number }[] = [];
  let max = -Infinity;
  let validCount = 0;
  
  timeData.sites.forEach(site => {
    const coords = siteCoordinates.value.get(site.siteId);
    if (coords && site.rain !== null && site.rain !== undefined) {
      const rainValue = parseFloat(site.rain as any);
      if (!isNaN(rainValue)) {
        data.push({
          lon: coords.lon,
          lat: coords.lat,
          val: rainValue
        });
        max = Math.max(max, rainValue);
        validCount++;
      }
    }
  });
  
  validDataCount.value = validCount;
  maxRain.value = max === -Infinity ? 0 : max;
  totalSites.value = sitesData.data.length;
  
  return data;
};

// 添加站点图层
const addSiteLayer = (map: mapboxgl.Map) => {
  console.log('=== addSiteLayer 调用 ===');
  console.log('showSites:', showSites.value);
  console.log('timeIndex:', timeIndex.value);
  console.log('currentTime:', timeOptions.value[timeIndex.value]);
  
  // 移除旧的站点图层
  if (map.getLayer('sites-circle')) map.removeLayer('sites-circle');
  if (map.getLayer('sites-label')) map.removeLayer('sites-label');
  if (map.getSource('sites')) map.removeSource('sites');
  
  // 如果不显示站点，直接返回
  if (!showSites.value) {
    console.log('站点显示已关闭');
    return;
  }
  
  const currentTime = timeOptions.value[timeIndex.value];
  const rainRecord = rainData.data.find(r => r.dateTime === currentTime);
  
  if (!rainRecord) {
    console.warn('未找到当前时刻的雨量数据:', currentTime);
    console.log('可用时间列表:', timeOptions.value.slice(0, 5));
    return;
  }
  
  console.log('雨量数据记录:', rainRecord.sites.length, '个站点');
  
  // 构造 GeoJSON 数据
  const features = rainRecord.sites.map(site => {
    const siteInfo = siteCoordinates.value.get(site.siteId);
    if (!siteInfo) {
      console.warn('未找到站点信息:', site.siteId);
      return null;
    }
    
    // 跳过 null 值
    if (site.rain === null || site.rain === undefined) {
      return null;
    }
    
    return {
      type: 'Feature',
      properties: {
        siteId: site.siteId,
        siteName: site.siteName,
        rainValue: site.rain.toFixed(1),
        displayText: `${site.rain.toFixed(1)}mm`
      },
      geometry: {
        type: 'Point',
        coordinates: [siteInfo.lon, siteInfo.lat]
      }
    };
  }).filter(f => f !== null);
  
  console.log('构建了', features.length, '个站点要素');
  
  if (features.length === 0) {
    console.warn('没有可显示的站点');
    return;
  }
  
  const geojson = {
    type: 'FeatureCollection',
    features
  };
  
  // 添加站点数据源
  map.addSource('sites', {
    type: 'geojson',
    data: geojson as any
  });
  
  // 添加站点圆点图层
  map.addLayer({
    id: 'sites-circle',
    type: 'circle',
    source: 'sites',
    paint: {
      'circle-radius': 6,
      'circle-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#333333',
      'circle-opacity': 0.9
    }
  });
  
  // 添加站点标注图层
  map.addLayer({
    id: 'sites-label',
    type: 'symbol',
    source: 'sites',
    layout: {
      'text-field': ['get', 'displayText'],
      'text-font': ['Noto Sans Regular'],  // MapLibre 开源字体
      'text-size': 12,
      'text-offset': [0, -1.5],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,  // 允许重叠
      'icon-allow-overlap': true
    },
    paint: {
      'text-color': '#ff0000',  // 临时用红色
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-halo-blur': 1
    }
  });
  
  // 添加点击事件（只添加一次）
  if (!map.hasClickHandler) {
    map.on('click', 'sites-circle', (e: any) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const { siteId, siteName, rainValue } = feature.properties;
      
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 8px;">
            <strong>${siteName}</strong><br>
            站点ID: ${siteId}<br>
            雨量: <strong>${rainValue} mm</strong>
          </div>
        `)
        .addTo(map);
    });
    
    // 鼠标悬停效果
    map.on('mouseenter', 'sites-circle', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'sites-circle', () => {
      map.getCanvas().style.cursor = '';
    });
    
    (map as any).hasClickHandler = true;
  }
  
  console.log(`✓ 添加了 ${features.length} 个站点标记`);
};

// 切换站点显示
const toggleSites = () => {
  if (!map) return;
  addSiteLayer(map);
};

// 初始化地图
const initMap = () => {
  if (!mapContainer.value) return;
  
  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',  // MapLibre 开源字体
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [
            `http://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`
          ],
          tileSize: 256
        },
        'raster-annotation': {
          type: 'raster',
          tiles: [
            `http://t0.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'simple-tiles',
          type: 'raster',
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 22
        },
        {
          id: 'simple-annotation',
          type: 'raster',
          source: 'raster-annotation',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    center: [120.6, 30.42],
    zoom: 10.5,
    pitch: 0,
    bearing: 0
  });
  
  map.on('load', () => {
    console.log('地图加载完成');
    
    // 添加海宁市边界图层
    if (map) {
      map.addSource('boundary', {
        type: 'geojson',
        data: hainingData as any
      });
      
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: {
          'fill-color': '#088',
          'fill-opacity': 0.1
        }
      });
      
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: {
          'line-color': '#088',
          'line-width': 2
        }
      });
      
      // 添加站点图层
      addSiteLayer(map);
    }
    
    // 显示第一个时间段
    if (timeOptions.value.length > 0) {
      updateHeatmap();
    }
  });
};

// 更新热力图
const updateHeatmap = () => {
  if (!map) return;
  
  const currentTime = timeOptions.value[timeIndex.value];
  if (!currentTime) return;
  
  // 移除旧图层
  if (heatmapLayer) {
    if (map.getLayer('rain-heatmap')) {
      map.removeLayer('rain-heatmap');
    }
    heatmapLayer = null;
  }
  
  // 准备数据
  const data = prepareHeatmapData(currentTime);
  
  if (data.length === 0) {
    console.warn('没有有效数据');
    return;
  }
  
  // 创建热力图层
  heatmapLayer = new MapboxInterpolateHeatmapLayer({
    id: 'rain-heatmap',
    data: data,
    opacity: opacity.value,
    p: idwPower.value,
    framebufferFactor: framebufferFactor.value,
    minValue: 0,  // 最小值固定为 0
    maxValue: maxRain.value,
    aoi: hainingAOI.value,  // 使用海宁市边界作为 AOI
    valueToColor: getColorSchemeCode(colorScheme.value, maxRain.value)
  });
  
  console.log('热力图层配置:', {
    时间: currentTime,
    数据点数: data.length,
    雨量范围: [0, maxRain.value],
    最大雨量: maxRain.value.toFixed(4),
    AOI坐标数: hainingAOI.value.length,
    参数: {
      opacity: opacity.value,
      p: idwPower.value,
      framebufferFactor: framebufferFactor.value,
      colorScheme: colorScheme.value
    }
  });
  
  // ========== 详细调试信息 ==========
  console.log('\n========== 时刻数据调试 ==========');
  console.log('当前时间:', currentTime);
  console.log('数据点数量:', data.length);
  console.log('最大雨量值:', maxRain.value.toFixed(4), 'mm');
  
  // 打印所有站点的雨量值
  console.log('\n所有站点雨量数据:');
  data.forEach((d, i) => {
    console.log(`  站点 ${i + 1}: 经度=${d.lon.toFixed(6)}, 纬度=${d.lat.toFixed(6)}, 雨量=${d.val.toFixed(4)}mm`);
  });
  
  // 打印颜色分级阈值
  console.log('\n颜色分级阈值对照:');
  console.log('  < 0.1mm        → 白色 (透明)');
  console.log('  0.1 - 4.9mm    → 浅绿色 #A6F28E');
  console.log('  5.0 - 14.9mm   → 深绿色 #3DB93D');
  console.log('  15.0 - 29.9mm  → 浅蓝色 #61B8FF');
  console.log('  30.0 - 69.9mm  → 深蓝色 #0000FE');
  console.log('  70.0 - 139.9mm → 紫红色 #F900FD');
  console.log('  >= 140mm       → 深红色 #A80000');
  
  // 打印着色器中的归一化阈值
  console.log('\n着色器归一化阈值 (value = rainValue / maxValue):');
  console.log(`  5mm  对应 value = ${(5 / maxRain.value).toFixed(4)}`);
  console.log(`  15mm 对应 value = ${(15 / maxRain.value).toFixed(4)}`);
  console.log(`  30mm 对应 value = ${(30 / maxRain.value).toFixed(4)}`);
  console.log(`  70mm 对应 value = ${(70 / maxRain.value).toFixed(4)}`);
  console.log(`  140mm 对应 value = ${(140 / maxRain.value).toFixed(4)}`);
  
  // 警告：当最大值小于5mm时，按照 IDW 插值原理，所有插值结果也应该 < 5mm
  if (maxRain.value < 5) {
    console.warn('\n⚠️ 诊断提示:');
    console.warn(`   当前最大雨量值 = ${maxRain.value.toFixed(2)}mm < 5mm`);
    console.warn('   按照 IDW 加权平均原理，所有插值结果也应该 < 5mm');
    console.warn('   因此热力图只应该显示: 白色（<0.1mm）或 浅绿色（0.1-4.9mm）');
    console.warn('   如果出现深绿/蓝/紫/红色，说明着色器计算异常！');
    console.warn('   可能原因: IDW 插值产生了 value > 1.0 的归一化值\n');
  }
  
  // 打印反归一化公式
  console.log('\n着色器反归一化公式:');
  console.log(`  rain = value * ${maxRain.value.toFixed(2)}`);
  console.log('  其中 value ∈ [0, 1] 是 IDW 插值归一化结果');
  
  console.log('========================================\n');
  
  map.addLayer(heatmapLayer as any);
  
  // 更新站点图层
  addSiteLayer(map);
};

// 时间改变回调
const onTimeChange = () => {
  updateHeatmap();
};

// 播放/暂停
const togglePlayback = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    playbackTimer = window.setInterval(() => {
      timeIndex.value = (timeIndex.value + 1) % timeOptions.value.length;
      updateHeatmap();
    }, 1000);
  } else {
    if (playbackTimer !== null) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  }
};

// 重置时间
const resetTime = () => {
  timeIndex.value = 0;
  updateHeatmap();
};

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (playbackTimer !== null) {
    clearInterval(playbackTimer);
  }
});
</script>

<style scoped>
.rain-heatmap-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.map-container {
  width: 100%;
  height: 100%;
}

/* 时间滑块容器 */
.time-slider-container {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 20px 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  min-width: 500px;
  max-width: 700px;
}

.time-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.time-label {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.playback-controls {
  display: flex;
  gap: 10px;
}

.play-btn, .reset-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #0078d4;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn:hover, .reset-btn:hover {
  background: #005a9e;
  transform: scale(1.05);
}

.play-btn.playing {
  background: #ff6b6b;
}

.time-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #e0e0e0 0%, #e0e0e0 100%);
  outline: none;
  -webkit-appearance: none;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #0078d4;
  cursor: pointer;
  transition: all 0.2s;
}

.time-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: #005a9e;
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #0078d4;
  cursor: pointer;
  border: none;
}

.time-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

/* 参数控制面板 */
.controls {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 15px rgba(0,0,0,0.1);
  min-width: 280px;
  max-width: 320px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

.controls h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
  border-bottom: 2px solid #0078d4;
  padding-bottom: 10px;
}

.param-group {
  margin-bottom: 20px;
}

.param-group label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.param-label {
  color: #333;
  font-weight: 500;
}

.param-value {
  color: #0078d4;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.param-group input[type="range"] {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e0e0e0;
  outline: none;
  -webkit-appearance: none;
}

.param-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #0078d4;
  cursor: pointer;
}

.param-group input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #0078d4;
  cursor: pointer;
  border: none;
}

.param-hint {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: #999;
  font-style: italic;
}

.color-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.color-select:focus {
  outline: none;
  border-color: #0078d4;
}

.stats {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.stats h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats p {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
}

.stats strong {
  color: #333;
  font-weight: 600;
}

/* 色带图例 */
.legend {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.legend h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legend-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rain-level {
  font-weight: 600;
  font-size: 13px;
}

.rain-value {
  font-size: 11px;
  opacity: 0.9;
}

/* 滚动条样式 */
.controls::-webkit-scrollbar {
  width: 6px;
}

.controls::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.controls::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
