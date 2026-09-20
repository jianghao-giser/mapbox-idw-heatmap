# 如何使用 HTML 示例

## 📖 简介

`rain-heatmap-demo.html` 是一个完全独立的 HTML 文件，可以直接在浏览器中打开，无需安装 Node.js 或任何构建工具！

## 🚀 快速开始（3 步）

### 第 1 步：获取 Mapbox Token

1. 访问 https://account.mapbox.com/
2. 注册一个免费账号（完全免费）
3. 进入 **Access tokens** 页面
4. 复制默认的 token（或创建一个新的）

示例 token 格式：
```
pk.eyJ1IjoidXNlcm5hbWUiLCJhIjoiY2xrZ3h5ejB4MDBoZjNkcXI2dHlzYzF4eSJ9.abcd1234efgh5678
```

### 第 2 步：配置 Token

1. 用文本编辑器（记事本、VS Code、Sublime 等）打开 `rain-heatmap-demo.html`
2. 找到第 **237** 行左右的代码：

```javascript
mapboxgl.accessToken = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJleGFtcGxlIn0.example';
```

3. 将整个 `'pk.eyJ...'` 替换成你刚才复制的 token：

```javascript
mapboxgl.accessToken = '你的token粘贴在这里';
```

4. 保存文件（Ctrl+S 或 Cmd+S）

### 第 3 步：打开文件

**方式 1：双击文件**
- 直接双击 `rain-heatmap-demo.html`
- 系统会用默认浏览器打开

**方式 2：拖拽到浏览器**
- 打开 Chrome/Firefox/Edge 等浏览器
- 把文件拖进浏览器窗口

**方式 3：右键菜单**
- 右键点击文件
- 选择"打开方式" → 选择浏览器

---

## 🎮 使用功能

打开后你会看到：

### 1. 地图区域
- 中心位置：中国浙江省（可缩放、拖动）
- 15 个白色圆点标记站点
- 彩色热力图显示降雨分布

### 2. 参数控制面板（右侧）

#### 不透明度
- 拖动滑块：0 ~ 1
- 控制热力图的透明度
- 数值越大越不透明

#### IDW 幂参数 (p)
- 拖动滑块：1 ~ 5
- 控制插值的影响范围
- **p=2**：标准 IDW（推荐）
- p 越大：影响范围越小，图案越尖锐
- p 越小：影响范围越大，图案越平滑

#### 分辨率
- 拖动滑块：20% ~ 100%
- 控制渲染质量
- 高分辨率：更细腻，但性能消耗大
- 低分辨率：性能好，但可能有锯齿

#### 颜色方案
- **降雨量分级（推荐）**：专业气象配色
- 彩虹：蓝→绿→黄→红渐变
- 热力：黑→红→黄渐变
- 冷色：蓝→青→白渐变
- 灰度：黑白渐变

### 3. 站点标记

点击地图上的白色圆点可以查看：
- 站点编号
- 经纬度坐标
- 实时雨量数据

### 4. 数据统计

显示：
- 站点总数：15
- 有效数据：15
- 雨量范围：0.0 ~ 45.2 mm

### 5. 降雨量分级图例

中国气象局标准分级：
- < 0.1 mm：无雨（白色）
- 0.1 ~ 4.9 mm：小雨（浅绿）
- 5 ~ 14.9 mm：中雨（深绿）
- 15 ~ 29.9 mm：大雨（浅蓝）
- 30 ~ 69.9 mm：暴雨（深蓝）
- 70 ~ 139.9 mm：大暴雨（紫红）
- ≥ 140 mm：特大暴雨（深红）

---

## 🔧 自定义数据

如果你想替换成自己的数据，编辑第 **241-255** 行：

```javascript
const mockRainData = [
  { lon: 120.55, lat: 30.35, val: 5.2 },   // 经度, 纬度, 雨量(mm)
  { lon: 120.58, lat: 30.38, val: 12.5 },
  // ... 添加更多站点
];
```

**数据格式：**
- `lon`：经度（东经为正，西经为负）
- `lat`：纬度（北纬为正，南纬为负）
- `val`：雨量值（单位：毫米）

---

## 🐛 常见问题

### Q1: 打开后显示"正在加载热力图..."一直不消失

**原因：** 没有配置 Mapbox Token 或 token 无效

**解决：**
1. 检查是否替换了 token
2. 检查 token 是否完整（以 `pk.` 开头）
3. 打开浏览器开发者工具（F12）查看错误信息

---

### Q2: 地图显示但没有热力图

**原因：** 浏览器控制台可能有 JavaScript 错误

**解决：**
1. 按 F12 打开开发者工具
2. 切换到 "Console" 标签
3. 查看红色错误信息
4. 确保 `dist/index.js` 文件存在（需要先运行 `npm run build`）

---

### Q3: 参数调整没有效果

**原因：** 可能是浏览器缓存问题

**解决：**
1. 按 Ctrl+Shift+R（Windows）或 Cmd+Shift+R（Mac）强制刷新
2. 或清除浏览器缓存后重新打开

---

### Q4: 想修改地图中心位置

编辑第 **314** 行：

```javascript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [120.60, 30.42],  // [经度, 纬度] ← 改这里
  zoom: 10                   // 缩放级别 (0-22)
});
```

---

### Q5: 如何更改配色方案默认值

编辑第 **199** 行：

```html
<select id="colorScheme" class="color-select">
  <option value="rainfall" selected>降雨量分级 (专业)</option>
  <!-- 在想要默认的选项上加 selected -->
</select>
```

---

## 📊 技术栈

- **Mapbox GL JS v3.0.1**：地图引擎
- **Mapbox IDW Heatmap**：自定义热力图图层
- **原生 JavaScript**：无任何框架依赖
- **HTML5 + CSS3**：界面和样式

---

## 🎓 进阶用法

### 集成到你的网站

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 引入 Mapbox CSS 和 JS -->
  <link href='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css' rel='stylesheet' />
  <script src='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'></script>
  
  <!-- 引入热力图库 -->
  <script src="path/to/dist/index.js"></script>
</head>
<body>
  <div id="map" style="width: 100%; height: 600px;"></div>
  
  <script>
    mapboxgl.accessToken = '你的token';
    
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [120.6, 30.4],
      zoom: 10
    });
    
    map.on('load', () => {
      const layer = new MapboxIDWHeatmapLayer({
        id: 'my-heatmap',
        data: [
          { lon: 120.5, lat: 30.3, val: 25 },
          { lon: 120.7, lat: 30.5, val: 30 }
        ]
      });
      
      map.addLayer(layer);
    });
  </script>
</body>
</html>
```

---

## 🌐 浏览器支持

| 浏览器 | 版本要求 |
|--------|----------|
| Chrome | ≥ 80 |
| Firefox | ≥ 75 |
| Safari | ≥ 13 |
| Edge | ≥ 80 |

---

## 📚 相关资源

- [Mapbox 官方文档](https://docs.mapbox.com/mapbox-gl-js/)
- [项目主 README](../README.md)
- [Vue 示例](./RainHeatmap.example.vue)
- [GitHub 仓库](https://github.com/jianghao-giser/mapbox-idw-heatmap)

---

## 💡 提示

1. **Mapbox 免费额度**：每月 50,000 次地图加载，对于个人项目完全够用
2. **性能优化**：如果站点超过 100 个，建议降低分辨率（framebufferFactor）
3. **移动端适配**：示例已经做了响应式设计，在手机上也能正常使用
4. **离线使用**：需要地图瓦片，无法完全离线，但可以使用 Mapbox 的离线方案

---

## ❓ 需要帮助？

如果遇到问题：
1. 查看浏览器控制台（F12）的错误信息
2. 阅读 [主 README](../README.md)
3. 提交 Issue: https://github.com/jianghao-giser/mapbox-idw-heatmap/issues

祝使用愉快！🎉
