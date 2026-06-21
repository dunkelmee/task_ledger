"""Exchange rate router — fetches from Frankfurter and persists in DB."""
import logging
import os
from datetime import date, datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExchangeRate
from ..schemas import ExchangeRateMap, ExchangeRateOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exchange-rates", tags=["exchange-rates"])

SUPPORTED_CURRENCIES = ["EUR", "CHF", "GBP", "USD", "CAD"]
BASE_CURRENCY = "EUR"

# Use self-hosted Frankfurter if available, otherwise fall back to the public API
_FRANKFURTER_URL = os.getenv("FRANKFURTER_URL", "https://api.frankfurter.dev")


def _symbols_param() -> str:
    return ",".join(c for c in SUPPORTED_CURRENCIES if c != BASE_CURRENCY)


async def fetch_and_store_rates(db: Session) -> dict:
    """Fetch latest rates from Frankfurter and upsert into the DB. Returns the rates dict."""
    url = f"{_FRANKFURTER_URL}/v1/latest"
    params = {"base": BASE_CURRENCY, "symbols": _symbols_param()}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    today = date.today()
    rates: dict = data.get("rates", {})
    # Always include base→base as 1.0
    rates[BASE_CURRENCY] = 1.0

    for target, rate_value in rates.items():
        existing = (
            db.query(ExchangeRate)
            .filter(
                ExchangeRate.base_currency == BASE_CURRENCY,
                ExchangeRate.target_currency == target,
                ExchangeRate.rate_date == today,
            )
            .first()
        )
        if existing:
            existing.rate = rate_value
            existing.fetched_at = datetime.utcnow()
        else:
            db.add(ExchangeRate(
                base_currency=BASE_CURRENCY,
                target_currency=target,
                rate=rate_value,
                rate_date=today,
                fetched_at=datetime.utcnow(),
            ))

    db.commit()
    return rates


@router.get("/latest", response_model=ExchangeRateMap)
async def get_latest_rates(db: Session = Depends(get_db)):
    """Return the most recent stored exchange rates. Fetches live if none stored today."""
    today = date.today()
    stored = (
        db.query(ExchangeRate)
        .filter(ExchangeRate.base_currency == BASE_CURRENCY, ExchangeRate.rate_date == today)
        .all()
    )

    if stored:
        rates_map = {r.target_currency: float(r.rate) for r in stored}
    else:
        # Fallback: fetch live
        try:
            rates_map = await fetch_and_store_rates(db)
        except Exception as exc:
            logger.warning("Could not fetch live rates: %s", exc)
            # Return most recent stored rates as fallback
            latest_stored = (
                db.query(ExchangeRate)
                .filter(ExchangeRate.base_currency == BASE_CURRENCY)
                .order_by(ExchangeRate.rate_date.desc())
                .all()
            )
            if latest_stored:
                seen: dict[str, float] = {}
                for r in latest_stored:
                    if r.target_currency not in seen:
                        seen[r.target_currency] = float(r.rate)
                rates_map = seen
                today = latest_stored[0].rate_date
            else:
                raise HTTPException(status_code=503, detail="No exchange rates available")

    return ExchangeRateMap(base=BASE_CURRENCY, date=today, rates=rates_map)


@router.post("/refresh", status_code=200)
async def refresh_rates(db: Session = Depends(get_db)):
    """Manually trigger a fetch from Frankfurter and persist the rates."""
    try:
        rates = await fetch_and_store_rates(db)
        return {"ok": True, "rates": rates, "date": date.today().isoformat()}
    except Exception as exc:
        logger.error("Rate refresh failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Frankfurter fetch failed: {exc}")
