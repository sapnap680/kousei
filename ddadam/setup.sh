#!/bin/bash
# Playwrightブラウザのインストール

echo "🚀 Playwrightセットアップを開始します..."

# システムパッケージの更新
echo "📦 システムパッケージを更新中..."
apt-get update -y

# 必要なシステム依存関係をインストール
echo "🔧 システム依存関係をインストール中..."
apt-get install -y \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libdrm2 \
    libxss1 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libpangocairo-1.0-0 \
    libepoxy0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcb-dri2-0 \
    libxcb-dri3-0 \
    libxcb-glx0 \
    libxcb-present0 \
    libxcb-sync1 \
    libxshmfence1 \
    libglu1-mesa \
    libegl1-mesa \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    libgles2-mesa \
    libglvnd0 \
    libglx0 \
    libopengl0 \
    libvulkan1 \
    libwayland-client0 \
    libwayland-egl1 \
    libwayland-server0 \
    libxcursor1 \
    libxext6 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    libcups2 \
    libdbus-1-3 \
    libpulse0

# Playwrightの依存関係をインストール
echo "🌐 Playwright依存関係をインストール中..."
python -m playwright install-deps chromium

# Playwrightブラウザをインストール
echo "🌐 Playwrightブラウザをインストール中..."
python -m playwright install chromium

# 権限設定
echo "🔐 権限を設定中..."
chmod -R 755 ~/.cache/ms-playwright/

# インストール確認
echo "✅ インストール完了確認中..."
python -m playwright --version

echo "🎉 Playwrightセットアップが完了しました！"
