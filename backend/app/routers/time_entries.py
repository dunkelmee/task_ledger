from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TimeEntry
from ..schemas import TimeEntryCreate, TimeEntryOut, TimeEntryUpdate

router = APIRouter(prefix="/time-entries", tags=["time_entries"])


@router.get("", response_model=List[TimeEntryOut])
def list_time_entries(
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    billable: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    q = db.query(TimeEntry)
    if project_id:
        q = q.filter(TimeEntry.project_id == project_id)
    if task_id:
        q = q.filter(TimeEntry.task_id == task_id)
    if billable is not None:
        q = q.filter(TimeEntry.billable == billable)
    return q.order_by(TimeEntry.date.desc()).all()


@router.post("", response_model=TimeEntryOut, status_code=201)
def create_time_entry(data: TimeEntryCreate, db: Session = Depends(get_db)):
    entry = TimeEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=TimeEntryOut)
def update_time_entry(entry_id: int, data: TimeEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    db.delete(entry)
    db.commit()
