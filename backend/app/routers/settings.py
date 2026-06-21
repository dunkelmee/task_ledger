from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSettings
from ..schemas import AppSettingsOut, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db: Session) -> AppSettings:
    settings = db.query(AppSettings).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=AppSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=AppSettingsOut)
def update_settings(data: AppSettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create(db)
    for k, v in data.model_dump().items():
        setattr(settings, k, v)
    db.commit()
    db.refresh(settings)
    return settings
