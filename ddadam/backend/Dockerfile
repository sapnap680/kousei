FROM mcr.microsoft.com/playwright/python:v1.55.0-jammy

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install browsers and deps
RUN playwright install-deps chromium && playwright install chromium

COPY backend/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
