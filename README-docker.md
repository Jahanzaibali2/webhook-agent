# Docker Deployment (Backend)

This repo supports production-grade Docker deployment for the backend/server.

## Usage

### 1. Build the Docker image
```bash
docker build -t ubl-voice-server .
```

### 2. Run the container
```bash
docker run -p 5000:5000 \
  -e PORT=5000 \
  -e OPENAI_API_KEY=sk-your-openai-key \
  -e OPENAI_REALTIME_MODEL=gpt-realtime \
  --name ubl-voice-server \
  ubl-voice-server
```

- The service will listen on TCP port 5000 (the default, can be changed via the `PORT` env var).
- Set your `OPENAI_API_KEY` and any custom `OPENAI_REALTIME_MODEL`.
- Additional env vars may be required for DB or production, see `server/index.ts` and documentation.

---
For GCP deployment:

- Ensure firewall allows TCP 5000 inbound to the VM.
- See OpenAI documentation for external SIP/RTP (those ports not implemented yet in this container).

---
