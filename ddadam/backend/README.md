# Backend (FastAPI + Playwright)

## Local run

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r backend/requirements.txt
python -m playwright install-deps chromium
python -m playwright install chromium
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Docker run

```bash
docker build -t jba-backend -f backend/Dockerfile .
docker run -p 8000:8000 jba-backend
```

## API

- GET /health
- POST /login { email, password }
- POST /search { session_cookies?, email?, password?, university_name }
