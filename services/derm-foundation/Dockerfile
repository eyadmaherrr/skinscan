# Optional Derm Foundation embedding service (see README.md). Not used unless SkinScan is configured to call it.
FROM python:3.11-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
ENV PORT=8080
EXPOSE 8080
# HF_TOKEN (with accepted HAI-DEF terms) must be provided at runtime; weights download on first start.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
