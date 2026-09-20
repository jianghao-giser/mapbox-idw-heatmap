# 📤 GitHub 上传指南

## 第一步：在 GitHub 上创建仓库

1. 打开浏览器，访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `mapbox-idw-heatmap`
   - **Description**: `基于 IDW 插值的 Mapbox GL 热力图图层，支持 AOI 裁剪和自定义配色方案`
   - **Public** 或 **Private**（根据需要选择）
   - ⚠️ **不要**勾选 "Initialize this repository with a README"
   - ⚠️ **不要**添加 .gitignore 或 license（我们已经有了）

3. 点击 **Create repository**

## 第二步：连接本地仓库到 GitHub

在终端执行以下命令（替换 `你的用户名` 为你的 GitHub 用户名）：

```bash
cd /Users/xwqin/Desktop/mapbox-idw-heatmap

# 添加远程仓库
git remote add origin https://github.com/你的用户名/mapbox-idw-heatmap.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

如果提示需要登录，输入你的 GitHub 用户名和密码（或 Personal Access Token）。

## 第三步：验证上传

1. 刷新 GitHub 仓库页面
2. 应该能看到所有文件已经上传
3. README.md 会自动显示在仓库首页

## 可选：配置 package.json

在推送前，修改 `package.json` 中的信息：

```json
{
  "author": "你的名字",
  "repository": {
    "type": "git",
    "url": "https://github.com/你的用户名/mapbox-idw-heatmap.git"
  }
}
```

然后重新提交：

```bash
git add package.json
git commit -m "📝 Update author and repository info"
git push
```

## 发布到 npm（可选）

如果想让别人通过 npm 安装你的包：

1. 注册 npm 账号: https://www.npmjs.com/signup

2. 登录 npm:
```bash
npm login
```

3. 构建并发布:
```bash
npm run build
npm publish
```

4. 之后别人就可以这样安装:
```bash
npm install mapbox-idw-heatmap
```

## 项目结构

```
mapbox-idw-heatmap/
├── src/
│   ├── index.ts                    # 入口文件
│   └── MapboxIDWHeatmapLayer.ts   # 核心图层代码
├── examples/
│   ├── README.md                   # 示例说明
│   └── RainHeatmap.example.vue    # Vue 示例
├── dist/                           # 构建输出（npm run build 后生成）
├── .gitignore                      # Git 忽略文件
├── .npmignore                      # npm 发布忽略文件
├── LICENSE                         # MIT 许可证
├── README.md                       # 项目文档
├── package.json                    # 包配置
├── tsconfig.json                   # TypeScript 配置
└── rollup.config.js               # 打包配置
```

## 常见问题

### Q1: 推送时提示 "Permission denied"

**解决方法**：使用 HTTPS URL 或配置 SSH key
```bash
# 方式1: HTTPS（推荐新手）
git remote set-url origin https://github.com/你的用户名/mapbox-idw-heatmap.git

# 方式2: SSH（需要先配置 SSH key）
git remote set-url origin git@github.com:你的用户名/mapbox-idw-heatmap.git
```

### Q2: 推送时提示 "Updates were rejected"

**解决方法**：强制推送（仅适用于新仓库）
```bash
git push -f origin main
```

### Q3: 想修改 commit 信息

**解决方法**：修改最后一次提交
```bash
git commit --amend -m "新的提交信息"
git push -f origin main
```

## 下一步

- ✅ 添加 GitHub Actions 自动构建
- ✅ 添加单元测试
- ✅ 添加在线 Demo
- ✅ 完善文档
- ✅ 添加更多示例

## 需要帮助？

- GitHub 文档: https://docs.github.com/cn
- npm 发布指南: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
