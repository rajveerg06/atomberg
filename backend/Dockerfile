# Production Dockerfile for Flask Backend
# Matches file: backend/Dockerfile

FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . /app/

# Expose port
EXPOSE 5000

# Run using gunicorn, binding to the dynamic PORT env variable provided by Railway/Render
CMD ["sh", "-c", "gunicorn -w 4 -b 0.0.0.0:${PORT:-5000} app:app"]
