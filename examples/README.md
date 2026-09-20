# 示例代码

## RainHeatmap.example.vue

完整的降雨量热力图 Vue 3 组件示例，展示了：

- ✅ 时间序列热力图
- ✅ 播放/暂停控制
- ✅ 参数动态调整（不透明度、IDW 幂参数、分辨率）
- ✅ 站点标注显示
- ✅ AOI 边界裁剪
- ✅ 降雨量专业配色方案

## 使用方法

1. 安装依赖：
```bash
npm install mapbox-idw-heatmap mapbox-gl
```

2. 准备数据文件：
   - `data/rain.json` - 时间序列雨量数据
   - `data/sites.json` - 站点坐标信息
   - `MapBox/haining.json` - AOI 边界 GeoJSON

3. 在 Vue 3 项目中引入组件

## 数据格式

### rain.json
```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "dateTime": "2026-08-14 19",
      "sites": [
        {
          "siteId": 21,
          "siteName": "站点名称",
          "rain": 1.5
        }
      ]
    }
  ]
}
```

### sites.json
```json
{
  "data": [
    {
      "siteId": 21,
      "siteName": "站点名称",
      "longitude": "120.123456",
      "latitude": "30.123456"
    }
  ]
}
```

### haining.json (GeoJSON MultiPolygon)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[[lon, lat], ...]]]
      }
    }
  ]
}
```
