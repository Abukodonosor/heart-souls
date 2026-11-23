# Darkheart runtime image: static game files + the tiny Python server. No dependencies, runs as a non-root user.
FROM docker.io/library/python:3.13-alpine
RUN adduser -D -u 10001 game
WORKDIR /app
COPY . .
RUN mkdir -p assets
USER game
ENV HOST=0.0.0.0 PORT=8000 ENABLE_SAVE=0 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "tools/server.py"]
