# Deploying to Railway

This guide deploys the freelance platform to [Railway](https://railway.app) as three
pieces:

| Local `docker-compose` service | On Railway |
| --- | --- |
| `db` (postgres:15) | **Railway Postgres** plugin (managed) |
| `frankfurter` | **Not deployed** — use the public API `https://api.frankfurter.dev` |
| `backend` (FastAPI) | **Service** built from `/backend`, private-only |
| `frontend` (nginx) | **Service** built from `/frontend`, the only public service |

### Target architecture

```
                 Internet
                    │
                    ▼
        ┌───────────────────────┐
        │  frontend (nginx)      │  public domain, port 80
        │  proxies /api/* ──────────┐
        └───────────────────────┘   │  http://backend.railway.internal
                                     ▼
                         ┌───────────────────────┐
                         │  backend (FastAPI)     │  private only, binds ::
                         └───────────┬───────────┘
                                     │  ${{Postgres.DATABASE_URL}}
                                     ▼
                         ┌───────────────────────┐
                         │  Railway Postgres      │
                         └───────────────────────┘
```

Only the **frontend** is exposed to the internet. The backend is reachable solely over
Railway's private network, and nginx proxies `/api/*` to it.

---

## Prerequisites

- This repo pushed to GitHub.
- A Railway account.

The repo is already deployment-ready — no dashboard start-command overrides are needed.
The relevant wiring lives in source:

- `backend/Dockerfile` &rarr; `CMD ["sh", "-c", "exec uvicorn app.main:app --host ${UVICORN_HOST:-0.0.0.0} --port ${PORT:-8000}"]`
  - Honors Railway's injected `$PORT`; defaults to `8000` locally.
  - Host defaults to `0.0.0.0` (local/IPv4) and is switched to `::` on Railway for
    IPv6 private networking via the `UVICORN_HOST` env var.
- `backend/app/routers/auth.py` &rarr; seed credentials read from `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` (fall back to `admin` / `Master_pass1234!` if unset).
- `frontend/nginx.conf` &rarr; proxies `/api/` to `${BACKEND_URL}`, baked in at container
  start by `envsubst`.

---

## Step 1 — Create the project

1. Railway &rarr; **New Project** &rarr; **Deploy from GitHub repo** &rarr; select this repo.
2. Railway will create one service from the repo. You'll reconfigure it as the backend
   in Step 3 and add the frontend in Step 4.

## Step 2 — Add Postgres

1. In the project canvas: **New &rarr; Database &rarr; Add PostgreSQL**.
2. This exposes a reference variable `${{Postgres.DATABASE_URL}}` (already in
   `postgresql://…` form, which the app's SQLAlchemy/psycopg2 setup accepts directly).

## Step 3 — Configure the **backend** service

**Settings &rarr; Source**

- **Root Directory:** `/backend` (uses `backend/Dockerfile`).

**Settings &rarr; Networking**

- Leave the backend **private** — do **not** generate a public domain. It's reached only
  through the frontend's proxy over the private network.

**Settings &rarr; Variables**

```
DATABASE_URL    = ${{Postgres.DATABASE_URL}}
SECRET_KEY      = <long random string — see below>
FRANKFURTER_URL = https://api.frankfurter.dev
UPLOAD_DIR      = /app/uploads
UVICORN_HOST    = ::
ADMIN_USERNAME  = tlorch
ADMIN_PASSWORD  = Pass1506!
```

Generate `SECRET_KEY` locally and paste the result:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> `SECRET_KEY` is required. Without it, JWTs are signed with the hardcoded fallback in
> `auth.py` and would be forgeable.

> `UVICORN_HOST = ::` makes uvicorn bind IPv6 so the frontend can reach it over Railway's
> IPv6-only private network. Keep this **unset locally** so it defaults to `0.0.0.0`.

**Settings &rarr; Volumes** (persist uploads)

- Add a volume mounted at **`/app/uploads`** (matches `UPLOAD_DIR`).
- Without it, uploaded attachments are wiped on every redeploy (container FS is
  ephemeral).

## Step 4 — Add the **frontend** service

1. **New &rarr; GitHub Repo &rarr; (same repo)** to create a second service.
2. **Settings &rarr; Source &rarr; Root Directory:** `/frontend`.
3. **Settings &rarr; Variables:**

   ```
   BACKEND_URL = http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
   ```

   This points nginx's `proxy_pass` at the backend over the private network. The value is
   baked in at container start by the `envsubst` step in `frontend/Dockerfile`.

   > Replace `backend` in the reference with your backend service's actual name if you
   > renamed it.

4. **Settings &rarr; Networking:**
   - Click **Generate Domain** (this is your app's public URL).
   - nginx listens on port **80** (`nginx.conf`), so set the target/exposed port to **80**
     if Railway doesn't auto-detect the `EXPOSE 80`.

## Step 5 — Deploy & verify

1. Deploy order: Postgres first, then backend, then frontend.
2. The backend creates its database schema automatically on first boot (migration block in
   `app/main.py`).
3. Open the **frontend** domain and log in.

---

## First login on a fresh database

A new Railway Postgres is empty, so on first boot the backend seeds the admin account from
your env vars:

- **Username:** `tlorch`
- **Password:** `Pass1506!`
- `must_change_password` is seeded as **`TRUE`** &rarr; you'll be prompted to set a new
  password on first login.

> The change-password policy requires **12+ characters** (plus upper/number/special), so
> the new password you choose at that prompt must satisfy that — `Pass1506!` (9 chars) is
> only valid as the *initial* seeded password, not as a replacement.

To skip the forced change entirely, the seed logic in `auth.py` can be adjusted to set
`must_change_password = FALSE` when the password comes from an explicit env var.

---

## Reference: environment variables

### Backend

| Variable | Value | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | ✅ | From the Postgres plugin |
| `SECRET_KEY` | random hex string | ✅ | JWT signing key |
| `FRANKFURTER_URL` | `https://api.frankfurter.dev` | ✅ | Public exchange-rate API |
| `UPLOAD_DIR` | `/app/uploads` | ✅ | Must match the mounted volume path |
| `UVICORN_HOST` | `::` | ✅ on Railway | IPv6 bind for private networking |
| `ADMIN_USERNAME` | `tlorch` | ⬜ | Defaults to `admin` if unset |
| `ADMIN_PASSWORD` | `Pass1506!` | ⬜ | Defaults to `Master_pass1234!` if unset |
| `PORT` | _(injected by Railway)_ | — | Do not set manually |

### Frontend

| Variable | Value | Required | Notes |
| --- | --- | --- | --- |
| `BACKEND_URL` | `http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}` | ✅ | Internal backend address for nginx proxy |

---

## Troubleshooting

- **Frontend loads but API calls 502/timeout** — `BACKEND_URL` is wrong, or the backend
  isn't binding IPv6. Confirm `UVICORN_HOST = ::` on the backend and that the backend logs
  show `Uvicorn running on http://[::]:<port>`.
- **Login rejected with the seeded credentials** — the database already had an
  `app_settings` row (the seed only runs when the password hash is empty). Reset it
  manually:
  ```sql
  -- run against the Railway Postgres
  UPDATE app_settings
     SET password_hash = '<bcrypt hash>', must_change_password = FALSE
   WHERE id = 1;
  ```
  Generate a bcrypt hash with the backend image:
  ```bash
  python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('YOUR_PASSWORD'))"
  ```
- **Uploads disappear after redeploy** — the `/app/uploads` volume isn't attached, or
  `UPLOAD_DIR` doesn't match the mount path.
