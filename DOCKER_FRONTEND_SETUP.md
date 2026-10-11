# LearnMate AI Docker frontend setup

The Next.js frontend is now a real Docker service. Nginx serves the browser entrypoint and proxies `/api/*` to FastAPI.

## Local Docker run

1. Create the root environment file:

```bash
cp .env.example .env
```

2. Set your local database/password/secrets and Gemini key in `.env`.

3. Build and start everything:

```bash
docker compose up --build
```

4. Open:

```text
http://localhost
```

The browser uses `/api/v1` as the API base URL. Nginx routes that to the `backend:8000` container, so the browser does not need to connect directly to port 8000 in the Docker setup.

## Direct Next.js development

For frontend-only development outside Docker, create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Then:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Important

Do not commit `.env`, `.env.local`, API keys, database passwords, or other secrets.
