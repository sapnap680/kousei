FROM mcr.microsoft.com/playwright/python:v1.55.0-jammy

WORKDIR /app

# 依存ライブラリをインストール
COPY ddadam/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Playwright + Chromium
RUN playwright install-deps chromium && playwright install chromium

# アプリ本体をコピー
COPY . .

# Render が使うポート番号は $PORT に入る
ENV STREAMLIT_BROWSER_GATHERUSAGESTATS=false
ENV PYTHONUNBUFFERED=1

CMD ["bash", "-lc", "streamlit run ddadam/realtime_web_verification_app.py --server.port=$PORT --server.address=0.0.0.0"]
