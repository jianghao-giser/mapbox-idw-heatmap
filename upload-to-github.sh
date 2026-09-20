#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Mapbox IDW Heatmap - GitHub 上传脚本${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 检查是否已经添加了远程仓库
if git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}⚠️  检测到已存在远程仓库:${NC}"
    git remote get-url origin
    echo ""
    read -p "是否要更新远程仓库地址？(y/N): " answer
    if [[ $answer = [Yy] ]]; then
        read -p "请输入你的 GitHub 用户名: " username
        git remote set-url origin "https://github.com/$username/mapbox-idw-heatmap.git"
        echo -e "${GREEN}✓ 远程仓库地址已更新${NC}\n"
    fi
else
    echo -e "${YELLOW}请输入你的 GitHub 信息:${NC}"
    read -p "GitHub 用户名: " username
    
    if [ -z "$username" ]; then
        echo -e "${RED}✗ 用户名不能为空${NC}"
        exit 1
    fi
    
    git remote add origin "https://github.com/$username/mapbox-idw-heatmap.git"
    echo -e "${GREEN}✓ 远程仓库已配置${NC}\n"
fi

# 显示当前状态
echo -e "${BLUE}当前仓库状态:${NC}"
git status -s
echo ""

# 检查 GitHub Token
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  未检测到 GITHUB_TOKEN 环境变量${NC}"
    echo -e "${YELLOW}如果推送失败，请设置 token:${NC}"
    echo -e "  export GITHUB_TOKEN=\"你的token\"\n"
fi

# 推送到 GitHub
echo -e "${BLUE}开始推送到 GitHub...${NC}\n"
git branch -M main

# 如果有 token，使用 token 认证
if [ ! -z "$GITHUB_TOKEN" ]; then
    # 临时修改 remote URL 使用 token
    original_url=$(git remote get-url origin)
    username=$(echo "$original_url" | sed -n 's|https://github.com/\([^/]*\)/.*|\1|p')
    git remote set-url origin "https://${username}:${GITHUB_TOKEN}@github.com/${username}/mapbox-idw-heatmap.git"
fi

if git push -u origin main; then
    # 恢复原始 URL（移除 token）
    if [ ! -z "$GITHUB_TOKEN" ] && [ ! -z "$original_url" ]; then
        git remote set-url origin "$original_url"
    fi
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ 成功推送到 GitHub!${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    
    # 显示仓库地址
    repo_url=$(git remote get-url origin | sed 's/\.git$//')
    echo -e "${BLUE}仓库地址:${NC} $repo_url"
    echo -e "${BLUE}在浏览器中打开:${NC} open $repo_url\n"
    
    # 询问是否打开浏览器
    read -p "是否在浏览器中打开仓库？(Y/n): " open_browser
    if [[ ! $open_browser = [Nn] ]]; then
        open "$repo_url" 2>/dev/null || echo -e "${YELLOW}无法自动打开浏览器，请手动访问: $repo_url${NC}"
    fi
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ✗ 推送失败${NC}"
    echo -e "${RED}========================================${NC}\n"
    echo -e "${YELLOW}常见问题:${NC}"
    echo "1. 确保你已经在 GitHub 上创建了 mapbox-idw-heatmap 仓库"
    echo "2. 检查网络连接"
    echo "3. 确保 GitHub 用户名正确"
    echo "4. 如果提示权限问题，可能需要配置 Personal Access Token"
    echo ""
    echo -e "${BLUE}详细帮助请查看:${NC} GITHUB_UPLOAD_GUIDE.md"
    exit 1
fi
