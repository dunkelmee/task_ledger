from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Reminder
from ..schemas import ReminderCreate, ReminderUpdate, ReminderOut
from .auth import get_current_user

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=List[ReminderOut])
def list_reminders(
    upcoming: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    q = db.query(Reminder)
    if upcoming:
        q = q.filter(Reminder.due_date >= date.today())
    return q.order_by(Reminder.due_date).all()


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(
    data: ReminderCreate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    reminder = Reminder(**data.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    data: ReminderUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(reminder, k, v)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
