FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

CMD ["sh", "-c", "exec uvicorn app.main:app --host ${UVICORN_HOST:-0.0.0.0} --port ${PORT:-8000}"]
