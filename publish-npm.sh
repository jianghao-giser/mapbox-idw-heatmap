#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  📦 npm 发布助手${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. 检查是否登录 npm
echo -e "${BLUE}检查 npm 登录状态...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  未登录 npm${NC}\n"
    echo -e "${BLUE}请先登录：${NC}"
    npm login
    echo ""
    
    if ! npm whoami &> /dev/null; then
        echo -e "${RED}❌ 登录失败${NC}"
        exit 1
    fi
fi

NPM_USER=$(npm whoami)
echo -e "${GREEN}✓ 已登录为: ${NPM_USER}${NC}\n"

# 2. 检查包名是否可用
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo -e "${BLUE}包信息：${NC}"
echo -e "  名称: ${PACKAGE_NAME}"
echo -e "  版本: ${PACKAGE_VERSION}\n"

echo -e "${BLUE}检查包名是否可用...${NC}"
if npm view "$PACKAGE_NAME" version &> /dev/null; then
    EXISTING_VERSION=$(npm view "$PACKAGE_NAME" version)
    echo -e "${YELLOW}⚠️  包名已存在，当前 npm 版本: ${EXISTING_VERSION}${NC}"
    
    if [ "$EXISTING_VERSION" = "$PACKAGE_VERSION" ]; then
        echo -e "${RED}❌ 版本号冲突！需要更新版本号${NC}\n"
        echo -e "${BLUE}可以运行：${NC}"
        echo "  npm version patch  # 补丁版本: $PACKAGE_VERSION -> $(node -p "require('semver').inc('$PACKAGE_VERSION', 'patch')" 2>/dev/null || echo '下一个版本')"
        echo "  npm version minor  # 次版本"
        echo "  npm version major  # 主版本"
        exit 1
    else
        echo -e "${GREEN}✓ 版本号有效（将更新到 ${PACKAGE_VERSION}）${NC}\n"
    fi
else
    echo -e "${GREEN}✓ 包名可用（首次发布）${NC}\n"
fi

# 3. 安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📥 安装依赖...${NC}"
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ 依赖安装完成${NC}\n"
else
    echo -e "${GREEN}✓ 依赖已存在${NC}\n"
fi

# 4. 运行构建
echo -e "${BLUE}🔨 构建项目...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi

# 5. 检查构建结果
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ 构建失败：dist 目录不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建完成${NC}\n"

# 6. 显示将要发布的文件
echo -e "${BLUE}📋 将要发布的文件：${NC}"
npm pack --dry-run | grep -v "npm notice" | head -20
echo ""

# 7. 确认发布
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}准备发布：${NC}"
echo -e "  包名: ${PACKAGE_NAME}"
echo -e "  版本: ${PACKAGE_VERSION}"
echo -e "  用户: ${NPM_USER}"
echo -e "${YELLOW}========================================${NC}\n"

read -p "确认发布到 npm？(y/N): " confirm
if [[ ! $confirm = [Yy] ]]; then
    echo -e "${YELLOW}❌ 取消发布${NC}"
    exit 0
fi

# 8. 发布
echo ""
echo -e "${BLUE}🚀 发布到 npm...${NC}\n"

# 如果是作用域包，需要 --access public
if [[ $PACKAGE_NAME == @* ]]; then
    npm publish --access public
else
    npm publish
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ 发布成功！${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    
    echo -e "${BLUE}📦 查看你的包：${NC}"
    echo "  https://www.npmjs.com/package/${PACKAGE_NAME}"
    echo ""
    
    echo -e "${BLUE}💾 用户安装：${NC}"
    echo "  npm install ${PACKAGE_NAME}"
    echo ""
    
    echo -e "${BLUE}🏷️  建议打标签：${NC}"
    echo "  git tag v${PACKAGE_VERSION}"
    echo "  git push --tags"
    echo ""
    
    # 询问是否打开浏览器
    read -p "是否在浏览器中打开 npm 包页面？(Y/n): " open_browser
    if [[ ! $open_browser = [Nn] ]]; then
        open "https://www.npmjs.com/package/${PACKAGE_NAME}" 2>/dev/null || echo -e "${YELLOW}无法自动打开浏览器${NC}"
    fi
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ❌ 发布失败${NC}"
    echo -e "${RED}========================================${NC}\n"
    
    echo -e "${YELLOW}常见问题：${NC}"
    echo "1. 包名已存在 - 修改 package.json 中的 name"
    echo "2. 版本号冲突 - 运行 npm version patch 更新版本"
    echo "3. 权限不足 - 检查是否登录正确的账号"
    echo "4. 网络问题 - 检查网络连接或切换 npm 源"
    echo ""
    echo -e "${BLUE}详细帮助请查看: NPM_PUBLISH_GUIDE.md${NC}"
    exit 1
fi
