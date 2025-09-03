#!/bin/bash
# Playwrightブラウザのインストール
echo "Installing Playwright browsers..."
python -m playwright install chromium
python -m playwright install-deps chromium

# 権限設定
chmod -R 755 ~/.cache/ms-playwright/

echo "Playwright setup completed!"
