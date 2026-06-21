from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Task
from ..schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Task)
    if project_id:
        q = q.filter(Task.project_id == project_id)
    if status:
        q = q.filter(Task.status == status)
    return q.order_by(Task.project_id, Task.position).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/move")
def move_task(task_id: int, status: str, position: int = 0, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = status
    task.position = position
    db.commit()
    return {"ok": True}


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
