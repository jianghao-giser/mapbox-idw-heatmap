# Mapbox IDW Heatmap

基于 **IDW（反距离加权）插值算法**的 Mapbox GL 热力图自定义图层，支持 AOI（研究区）裁剪和灵活的配色方案。

## ✨ 特性

- 🎯 **高性能 WebGL 实现** - 利用 GPU 并行计算 IDW 插值
- ✂️ **AOI 裁剪** - 支持复杂多边形边界裁剪，只显示感兴趣区域
- 🎨 **灵活配色** - 支持自定义 GLSL 着色器函数实现任意配色方案
- 📊 **专业降雨量分级** - 内置气象标准的降雨量颜色映射
- ⚡ **可调参数** - 可调整 IDW 幂参数、分辨率、透明度等
- 🔧 **TypeScript 支持** - 完整的类型定义

## 📦 安装

```bash
npm install mapbox-idw-heatmap
```

或

```bash
yarn add mapbox-idw-heatmap
```

## 🚀 快速开始

```typescript
import mapboxgl from 'mapbox-gl';
import { MapboxInterpolateHeatmapLayer } from 'mapbox-idw-heatmap';

// 初始化地图
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [120.6, 30.42],
  zoom: 10
});

// 准备数据
const data = [
  { lon: 120.5, lat: 30.4, val: 12.5 },
  { lon: 120.6, lat: 30.5, val: 8.3 },
  { lon: 120.7, lat: 30.3, val: 15.2 }
  // ... 更多数据点
];

// 创建热力图层
const heatmapLayer = new MapboxInterpolateHeatmapLayer({
  id: 'rainfall-heatmap',
  data: data,
  minValue: 0,
  maxValue: 50,
  opacity: 0.6,
  p: 2  // IDW 幂参数
});

// 添加到地图
map.on('load', () => {
  map.addLayer(heatmapLayer);
});
```

## 📖 API 文档

### `MapboxInterpolateHeatmapLayerOptions`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | **必需** | 图层唯一标识符 |
| `data` | `Array<{lon, lat, val}>` | **必需** | 数据点数组 |
| `minValue` | `number` | `0` | 数据最小值（用于归一化） |
| `maxValue` | `number` | `1` | 数据最大值（用于归一化） |
| `opacity` | `number` | `0.5` | 图层不透明度 (0-1) |
| `p` | `number` | `2` | IDW 幂参数，越大影响范围越小 |
| `framebufferFactor` | `number` | `0.3` | 帧缓冲分辨率因子 (0-1) |
| `aoi` | `Array<{lon, lat}>` | `undefined` | 研究区边界多边形坐标 |
| `valueToColor` | `string` | 见下文 | 自定义 GLSL 颜色映射函数 |
| `valueToColor4` | `string` | 见下文 | 自定义 GLSL 颜色+透明度函数 |

### IDW 幂参数说明

- `p = 1`: 线性插值，影响范围大，结果平滑
- `p = 2`: **标准 IDW**（推荐）
- `p > 2`: 影响范围小，局部化，边界尖锐

### 自定义配色方案

通过 `valueToColor` 参数传入 GLSL 着色器代码：

```typescript
const customColorScheme = `
  vec3 valueToColor(float value) {
    // value 是归一化后的值 [0, 1]
    // 反归一化为实际值
    float rain = value * 50.0;  // maxValue = 50
    
    if (rain < 10.0) {
      return vec3(0.0, 1.0, 0.0);  // 绿色
    } else if (rain < 30.0) {
      return vec3(1.0, 1.0, 0.0);  // 黄色
    } else {
      return vec3(1.0, 0.0, 0.0);  // 红色
    }
  }
`;

const layer = new MapboxInterpolateHeatmapLayer({
  id: 'custom-heatmap',
  data: data,
  maxValue: 50,
  valueToColor: customColorScheme
});
```

## 🌈 内置配色方案示例

### 降雨量专业分级（气象标准）

```typescript
const rainfallColorScheme = `
  vec3 valueToColor(float value) {
    float rain = value * maxValue;
    
    if (rain < 0.1) return vec3(1.0, 1.0, 1.0);        // 无雨
    else if (rain < 5.0) return vec3(0.651, 0.949, 0.557);  // 小雨
    else if (rain < 15.0) return vec3(0.239, 0.725, 0.239); // 中雨
    else if (rain < 30.0) return vec3(0.380, 0.722, 1.0);   // 大雨
    else if (rain < 70.0) return vec3(0.0, 0.0, 0.996);     // 暴雨
    else if (rain < 140.0) return vec3(0.976, 0.0, 0.992);  // 大暴雨
    else return vec3(0.659, 0.0, 0.0);                       // 特大暴雨
  }
`;
```

## 🎯 AOI 裁剪示例

```typescript
// 定义研究区边界（多边形）
const boundary = [
  { lon: 120.5, lat: 30.3 },
  { lon: 120.7, lat: 30.3 },
  { lon: 120.7, lat: 30.5 },
  { lon: 120.5, lat: 30.5 },
  { lon: 120.5, lat: 30.3 }  // 闭合
];

const layer = new MapboxInterpolateHeatmapLayer({
  id: 'clipped-heatmap',
  data: data,
  aoi: boundary  // 只显示边界内的热力图
});
```

## 🔧 完整示例

查看 `examples/` 目录获取完整的 Vue、React 示例。

### Vue 3 示例

```vue
<template>
  <div ref="mapContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import mapboxgl from 'mapbox-gl';
import { MapboxInterpolateHeatmapLayer } from 'mapbox-idw-heatmap';

const mapContainer = ref<HTMLDivElement>();

onMounted(() => {
  const map = new mapboxgl.Map({
    container: mapContainer.value!,
    style: 'mapbox://styles/mapbox/light-v11',
    center: [120.6, 30.42],
    zoom: 10
  });

  map.on('load', () => {
    const data = [
      { lon: 120.5, lat: 30.4, val: 12.5 },
      { lon: 120.6, lat: 30.5, val: 8.3 }
    ];

    const layer = new MapboxInterpolateHeatmapLayer({
      id: 'rainfall',
      data: data,
      maxValue: 50,
      opacity: 0.6
    });

    map.addLayer(layer);
  });
});
</script>
```

## 🧪 性能优化建议

1. **调整分辨率** - `framebufferFactor` 越小性能越好，但质量下降
   - 高质量：`0.8 - 1.0`
   - 平衡：`0.5`（推荐）
   - 性能优先：`0.2 - 0.3`

2. **数据点数量** - 建议控制在 100 个点以内获得最佳性能

3. **AOI 复杂度** - 边界顶点数建议 < 1000

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

- GitHub: https://github.com/你的用户名/mapbox-idw-heatmap
- Email: your-email@example.com
