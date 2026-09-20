# 📦 npm 发布指南

## 准备工作

### 1. 注册 npm 账号
如果还没有 npm 账号，访问 https://www.npmjs.com/signup 注册

### 2. 检查包名是否可用
访问 https://www.npmjs.com/package/mapbox-idw-heatmap
- 如果显示 404，说明包名可用 ✅
- 如果已存在，需要修改 `package.json` 中的 `name` 字段

---

## 发布步骤

### 第一步：安装依赖
```bash
npm install
```

### 第二步：构建项目
```bash
npm run build
```

构建成功后，会生成 `dist` 目录，包含：
- `index.js` - CommonJS 格式
- `index.esm.js` - ES Module 格式  
- `index.d.ts` - TypeScript 类型定义

### 第三步：测试构建结果（可选）
```bash
# 查看将要发布的文件列表
npm pack --dry-run

# 或者打包成 .tgz 测试
npm pack
# 生成 mapbox-idw-heatmap-1.0.0.tgz
# 可以在其他项目测试：npm install ./mapbox-idw-heatmap-1.0.0.tgz
```

### 第四步：登录 npm
```bash
npm login
```

会提示输入：
- **Username**: 你的 npm 用户名
- **Password**: 你的 npm 密码
- **Email**: 你的邮箱
- **OTP（可选）**: 如果开启了两步验证

### 第五步：发布
```bash
npm publish
```

看到类似输出说明发布成功：
```
+ mapbox-idw-heatmap@1.0.0
```

---

## 发布后

### 查看你的包
访问：https://www.npmjs.com/package/mapbox-idw-heatmap

### 用户安装
```bash
npm install mapbox-idw-heatmap
```

### 使用示例
```typescript
import { MapboxIDWHeatmapLayer } from 'mapbox-idw-heatmap';

const layer = new MapboxIDWHeatmapLayer({
  id: 'rainfall-heatmap',
  data: [
    { lng: 116.4, lat: 39.9, value: 25.5 },
    { lng: 121.5, lat: 31.2, value: 30.2 }
  ]
});

map.addLayer(layer);
```

---

## 更新版本

当你修改代码需要发布新版本时：

### 1. 更新版本号
```bash
# 补丁版本（bug 修复）：1.0.0 -> 1.0.1
npm version patch

# 次版本（新功能）：1.0.1 -> 1.1.0  
npm version minor

# 主版本（破坏性变更）：1.1.0 -> 2.0.0
npm version major
```

### 2. 重新构建和发布
```bash
npm run build
npm publish
```

### 3. 推送到 GitHub
```bash
git push && git push --tags
```

---

## 常见问题

### ❌ 包名已存在
**错误**：`403 Forbidden - PUT https://registry.npmjs.org/mapbox-idw-heatmap - You do not have permission to publish`

**解决**：修改 `package.json` 中的 `name`，例如：
```json
{
  "name": "@jianghao-giser/mapbox-idw-heatmap"
}
```

使用作用域包（scope package）需要公开发布：
```bash
npm publish --access public
```

### ❌ 未登录
**错误**：`npm ERR! need auth This command requires you to be logged in.`

**解决**：运行 `npm login`

### ❌ 构建失败
**错误**：`dist` 目录不存在或文件缺失

**解决**：
1. 检查 `npm run build` 是否成功
2. 检查 `package.json` 中的 `files` 字段是否包含 `dist`
3. 检查 `.npmignore` 是否错误地忽略了 `dist`

### ❌ 版本号冲突
**错误**：`403 Forbidden - cannot modify pre-existing version`

**解决**：增加版本号后重新发布
```bash
npm version patch
npm publish
```

---

## 撤销发布

如果发布后 24 小时内发现问题，可以撤销：

```bash
# 撤销指定版本
npm unpublish mapbox-idw-heatmap@1.0.0

# 撤销整个包（慎用！）
npm unpublish mapbox-idw-heatmap --force
```

⚠️ **注意**：
- 撤销发布后，72 小时内不能使用相同的包名和版本号
- 如果包已被下载使用，不建议撤销，应该发布修复版本

---

## 最佳实践

✅ 发布前运行测试（如果有）
✅ 检查 README.md 是否完善
✅ 确保 LICENSE 文件存在
✅ 语义化版本管理
✅ 在 CHANGELOG.md 中记录变更（推荐）
✅ 发布后打 Git tag：`git tag v1.0.0 && git push --tags`

---

## 快速发布脚本

你也可以创建一个自动化脚本：

```bash
#!/bin/bash
# publish-npm.sh

echo "📦 准备发布到 npm..."

# 1. 安装依赖
echo "1️⃣ 安装依赖..."
npm install || exit 1

# 2. 运行构建
echo "2️⃣ 构建项目..."
npm run build || exit 1

# 3. 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败：dist 目录不存在"
    exit 1
fi

# 4. 显示将要发布的文件
echo "3️⃣ 将要发布的文件："
npm pack --dry-run

# 5. 确认发布
read -p "确认发布？(y/N): " confirm
if [[ ! $confirm = [Yy] ]]; then
    echo "❌ 取消发布"
    exit 0
fi

# 6. 发布
echo "4️⃣ 发布到 npm..."
npm publish

echo "✅ 发布完成！"
echo "查看：https://www.npmjs.com/package/mapbox-idw-heatmap"
```

使用：
```bash
chmod +x publish-npm.sh
./publish-npm.sh
```
