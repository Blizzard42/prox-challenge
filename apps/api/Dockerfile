# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install system dependencies (e.g. for PyMuPDF or Chroma if needed)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend codebase
COPY . .

# Expose port (Cloud Run / Render use $PORT usually, default to 8000)
ENV PORT="8000"

# Command to run the standard uvicorn worker
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
