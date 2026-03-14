# Deploy on Hostinger Docker Manager

This guide uses the **single-file** `docker-compose.hostinger.yml` and Hostinger's **Traefik** template so your app is served over HTTPS with a custom domain (e.g. **gencl.mapims.edu.in**).

## Ports (no conflict with other projects)

If you already run other Docker projects (e.g. **ambulance_qr**, **mrd_cl**), this stack avoids their ports:

| Project       | Host ports in use        |
|---------------|---------------------------|
| ambulance_qr  | 8085, 5010                |
| mrd_cl        | 3000, 5000, 27017         |
| **gencl**     | **8082** (frontend only)  |

- **gencl** exposes only the frontend on host port **8082** by default (override with `HTTP_PORT`).
- Backend and MongoDB have **no host ports** (internal only), so they never conflict.
- With **Traefik**, users reach the app at **https://gencl.mapims.edu.in**; port 8082 is still available as a fallback (e.g. `http://your-server:8082`).

To use a different host port, set `HTTP_PORT` (e.g. `HTTP_PORT=8083`) in the project’s environment.

## Prerequisites

- Hostinger VPS with **Docker Manager**.
- A domain (or subdomain) pointing to your VPS IP (e.g. **gencl.mapims.edu.in**).
- The **Traefik** project deployed first in Docker Manager (creates the `traefik-proxy` network and handles HTTPS).

## Step 1: Deploy Traefik (once per VPS)

In Hostinger Docker Manager:

1. Create a new project.
2. Use the **Traefik** template (or “Compose from URL” / “Compose Manually” with Hostinger’s Traefik compose).
3. Deploy it so the `traefik-proxy` network exists and Traefik is listening on ports 80/443.

## Step 2: Deploy this app

### Option A: Compose from URL

1. Push this repo to **GitHub** or **GitLab** (can be private if Hostinger supports your Git provider).
2. In Docker Manager, create a new project → **Compose from URL**.
3. Enter the repo URL and set the path to the Compose file: **`docker-compose.hostinger.yml`** (if the UI asks for a file path).
4. Ensure the build context is the **repository root** (so `./backend` and `./frontend` resolve).

### Option B: Compose Manually

1. In Docker Manager, create a new project → **Compose Manually**.
2. Copy the full contents of **`docker-compose.hostinger.yml`** into the YAML editor.
3. **Note:** Manual paste only works if Hostinger supports building from a connected repo or uploaded context. If builds are not available, use Option A (Compose from URL) so the manager can clone and build.

## Step 3: Set environment variables

In the same project, open **Environment** (or **Variables**) and set:

| Variable      | Required | Example / note |
|---------------|----------|-----------------|
| `DOMAIN`      | Yes      | Your public host, e.g. **gencl.mapims.edu.in** (no `https://`) |
| `CORS_ORIGIN` | Yes      | Full origin: **https://gencl.mapims.edu.in** (no trailing slash) |
| `JWT_SECRET`  | Yes      | Long random string (at least 32 characters). e.g. `openssl rand -base64 32` |
| `MONGO_URI`   | No       | Default: `mongodb://mongo:27017/gen_cl`. Change only if you use external MongoDB or auth. |
| `HTTP_PORT`   | No       | Host port for frontend. Default **8082** (avoids 3000, 5000, 8085, 5010, 27017). |

- **DOMAIN** is used in Traefik’s `Host()` rule and must match your DNS.
- **CORS_ORIGIN** must be exactly the URL the browser uses (scheme + host, no path).

## Step 4: Build and start

1. Start (or “Deploy”) the project so Docker builds `backend` and `frontend` and starts `mongo`, `backend`, and `frontend`.
2. Wait until all containers are running and healthy.
3. Open **https://gencl.mapims.edu.in** (or your DOMAIN). Traefik will terminate TLS and route to the frontend; the frontend proxies `/api` to the backend. Without Traefik, use **http://your-server:8082**.

## Default login

After first run, the backend creates a default admin:

- **Email:** `admin@hospital.com`  
- **Password:** `TataTiago@2026`  

Change the password after first login.

## Optional: Seed data

To load departments, users, forms, and sample data:

- In Docker Manager, open the **backend** container’s shell (or use “Execute command” if available) and run:
  ```bash
  node src/scripts/seedAllScreens.js
  ```
- Or from your machine with Docker CLI and Hostinger’s Compose project:
  ```bash
  docker compose -f docker-compose.hostinger.yml exec backend node src/scripts/seedAllScreens.js
  ```

## Troubleshooting

- **502 Bad Gateway:** Backend or frontend not ready. Check container logs; ensure backend passes its healthcheck (`/health`).
- **CORS errors in browser:** Set `CORS_ORIGIN` exactly to the URL in the address bar (e.g. `https://app.yourdomain.com`), no trailing slash.
- **Traefik not routing:** Ensure the Traefik project is running and the app’s frontend is on the `traefik-proxy` network. Check that `DOMAIN` matches your DNS and that Traefik’s entrypoints are `web` / `websecure` (if your template uses different names, adjust the labels in `docker-compose.hostinger.yml`).
- **Build fails (Compose Manually):** Use **Compose from URL** so the manager can clone the repo and build from `./backend` and `./frontend`.
