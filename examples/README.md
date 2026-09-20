# 示例

本目录包含 Mapbox IDW Heatmap 的使用示例。

## 🚀 快速开始

### rain-heatmap-demo.html

**独立的 HTML 示例，无需构建工具，直接在浏览器中打开！**

#### 使用方法：

1. **获取 Mapbox Access Token**
   - 访问 https://account.mapbox.com/
   - 注册免费账号
   - 创建一个 Access Token
   - 复制 token

2. **配置 Token**
   - 打开 `rain-heatmap-demo.html`
   - 找到第 237 行：
     ```javascript
     mapboxgl.accessToken = 'pk.eyJ1IjoiZXhhbXBsZSI...';
     ```
   - 替换成你的 token

3. **运行示例**
   - 直接双击 `rain-heatmap-demo.html` 文件
   - 或者用浏览器打开
   - 🎉 完成！

#### 功能特性：
- ✅ 内置模拟降雨数据（15个站点）
- ✅ 实时参数调整（不透明度、幂参数、分辨率）
- ✅ 多种配色方案切换
- ✅ 站点标记和弹窗
- ✅ 数据统计面板
- ✅ 降雨量分级图例

---

## RainHeatmap.example.vue

**完整的 Vue 3 组件示例**，适合集成到 Vue 项目中。

### 功能特性

- ✅ IDW 插值算法
- ✅ 多种配色方案
- ✅ AOI 区域裁剪（海宁市边界）
- ✅ 时间轴回放
- ✅ 参数实时调整
- ✅ 站点位置标记
- ✅ 详细的数据统计

### 使用方法

1. 将此组件复制到你的 Vue 3 项目中
2. 安装依赖：
   ```bash
   npm install mapbox-gl mapbox-idw-heatmap
   ```
3. 准备数据文件：
   - `data/sites.json` - 站点信息
   - `data/rain.json` - 降雨数据
   - `MapBox/haining.json` - 区域边界（GeoJSON）
4. 在你的路由或页面中引入组件

### 数据格式

**sites.json**
```json
{
  "data": [
    {
      "siteId": "001",
      "siteName": "站点名称",
      "longitude": "120.123",
      "latitude": "30.456"
    }
  ]
}
```

**rain.json**
```json
{
  "data": [
    {
      "dateTime": "2026-08-14 19",
      "sites": [
        {
          "siteId": "001",
          "siteName": "站点名称",
          "rain": 25.5
        }
      ]
    }
  ]
}
```

---

## 对比

| 特性 | HTML 示例 | Vue 示例 |
|------|-----------|----------|
| 运行方式 | 直接打开 | 需要 Vue 项目 |
| 数据源 | 内置模拟数据 | 外部 JSON 文件 |
| 时间轴 | ❌ | ✅ |
| AOI 裁剪 | ❌ | ✅ |
| 参数控制 | ✅ | ✅ |
| 站点标记 | ✅ | ✅ |
| 适用场景 | 快速演示、学习 | 生产环境 |

---

## 需要帮助？

- 查看主 README: [../README.md](../README.md)
- 查看 npm 包: https://www.npmjs.com/package/mapbox-idw-heatmap
- 提交 Issue: https://github.com/jianghao-giser/mapbox-idw-heatmap/issues
