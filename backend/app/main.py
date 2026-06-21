import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine, Base, SessionLocal
from .routers import clients, proposals, projects, tasks, invoices, payments, expenses, time_entries, dashboard, settings
from .routers import auth, reminders, exchange_rates, attachments
from .routers.auth import get_current_user

logger = logging.getLogger(__name__)

# Create all tables on startup (new tables only — idempotent)
Base.metadata.create_all(bind=engine)

# Additive migrations — safely add new columns to existing tables
_MIGRATIONS = [
    # app_settings new columns (v2)
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255) DEFAULT ''",
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS position VARCHAR(255) DEFAULT ''",
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT ''",
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT ''",
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE",
    # payments.invoice_id was previously NOT NULL — make it nullable for multi-invoice support
    "ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL",
    # proposals.currency column (v3)
    "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD'",
    # attachments table (v4)
    """CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(500) NOT NULL,
        size INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT now()
    )""",
    # expense attachments (v5)
    "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE",
    # client logo + contact position/avatar (v6)
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo TEXT",
    "ALTER TABLE contacts RENAME COLUMN role TO position",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar TEXT",
]

with engine.connect() as conn:
    for stmt in _MIGRATIONS:
        try:
            conn.execute(text(stmt))
        except Exception:
            pass  # column already exists or no-op
    conn.commit()


# ── Daily exchange-rate scheduler ────────────────────────────────────────────

async def _daily_rate_fetch():
    """Fetch exchange rates from Frankfurter every day at 08:00 local time."""
    from .routers.exchange_rates import fetch_and_store_rates
    while True:
        from datetime import datetime, time as dtime
        import time as _time
        now = datetime.now()
        target = datetime.combine(now.date(), dtime(8, 0, 0))
        if target <= now:
            # Already past 8 AM — schedule for tomorrow
            from datetime import timedelta
            target += timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        logger.info("Exchange-rate scheduler: next fetch in %.0f s (at %s)", wait_seconds, target)
        await asyncio.sleep(wait_seconds)

        db = SessionLocal()
        try:
            await fetch_and_store_rates(db)
            logger.info("Exchange rates refreshed successfully")
        except Exception as exc:
            logger.warning("Exchange rate fetch failed: %s", exc)
        finally:
            db.close()

        # Sleep a bit before looping so we don't double-fetch at exactly 08:00
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background scheduler
    task = asyncio.create_task(_daily_rate_fetch())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="TaskLedger API",
    description="Solo freelancer workflow management",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no auth required)
app.include_router(auth.router, prefix="/api")

# Exchange rates — public so the frontend can read without login too
app.include_router(exchange_rates.router, prefix="/api")

# Protected routes (JWT required)
_auth_dep = [Depends(get_current_user)]
for router in [
    clients.router,
    proposals.router,
    projects.router,
    tasks.router,
    invoices.router,
    payments.router,
    expenses.router,
    time_entries.router,
    dashboard.router,
    settings.router,
    reminders.router,
    attachments.router,
]:
    app.include_router(router, prefix="/api", dependencies=_auth_dep)


@app.get("/health")
def health():
    return {"status": "ok"}
