# Backend Dockerfile for GST360 API
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY pyproject.toml .

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi>=0.109.0 \
    "uvicorn[standard]>=0.27.0" \
    sqlalchemy>=2.0.0 \
    pydantic>=2.0.0 \
    "pydantic[email]>=2.0.0" \
    python-multipart>=0.0.6 \
    python-dotenv>=1.0.0 \
    langgraph>=0.2.0 \
    anthropic>=0.40.0 \
    pillow>=10.0.0 \
    boto3>=1.34.0 \
    psycopg2-binary>=2.9.0

# Copy application code
COPY backend/ .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
