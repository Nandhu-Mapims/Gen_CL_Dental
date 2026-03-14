# Running with Docker

**Deploy on Hostinger (HTTPS + Traefik):** see [README-HOSTINGER.md](README-HOSTINGER.md) and use `docker-compose.hostinger.yml`.

## Quick start

From the project root (`Gen_CL`):

```bash
docker compose up --build
```

- **App (frontend):** http://localhost  
- **API:** proxied at http://localhost/api (backend runs inside Docker, no direct port exposed).

Default admin (created on first run): **admin@hospital.com** / **TataTiago@2026**

## Seed data (optional)

To populate departments, users, locations, shifts, forms, and submissions:

```bash
docker compose exec backend node src/scripts/seedAllScreens.js --reset
```

## Stop

```bash
docker compose down
```

To remove the MongoDB data volume as well:

```bash
docker compose down -v
```

## Environment (docker-compose)

Backend receives:

- `MONGO_URI=mongodb://mongo:27017/gen_cl_dental`
- `JWT_SECRET` (set in docker-compose.yml)
- `CORS_ORIGIN=http://localhost` (must match the URL you use to open the app)

To change port (e.g. frontend on 8080), in `docker-compose.yml` set `frontend.ports` to `"8080:80"` and use http://localhost:8080; set `CORS_ORIGIN=http://localhost:8080`.

---

## Production deployment

For production, use the production override so that:

- MongoDB is not exposed on the host (only backend can connect).
- Backend and frontend use env from `.env.production`.
- Backend has a health check at `/health`.

### Steps

1. **Create production env file**

   ```bash
   cp .env.production.example .env.production
   ```

   Edit `.env.production` and set:

   - `MONGO_URI` – e.g. `mongodb://mongo:27017/gen_cl_dental` (or with auth; see example).
   - `JWT_SECRET` – strong random string (min 32 characters).
   - `CORS_ORIGIN` – public URL of the app, e.g. `https://your-domain.com` (no trailing slash).

   Optional: `HTTP_PORT` (default `80`) if you want the app on another port.

2. **Build and run**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

3. **Put a reverse proxy in front (recommended)**  
   Use Nginx, Caddy, or your host’s proxy in front of port 80/443 so you can:

   - Terminate TLS (HTTPS).
   - Use a real hostname and set `CORS_ORIGIN` to that URL.

4. **Seed data (optional)**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend node src/scripts/seedAllScreens.js
   ```

5. **Stop**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down
   ```
