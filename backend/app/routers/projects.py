from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Project, Task, Invoice, TimeEntry, Contact
from ..schemas import ProjectCreate, ProjectOut, ProjectUpdate, TaskOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectOut])
def list_projects(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    if client_id:
        q = q.filter(Project.client_id == client_id)
    return q.order_by(Project.created_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    contact_ids = data.contact_ids
    project = Project(**data.model_dump(exclude={"contact_ids"}))
    db.add(project)
    db.flush()
    if contact_ids:
        project.contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in data.model_dump(exclude_none=True, exclude={"contact_ids"}).items():
        setattr(project, k, v)
    project.contacts = db.query(Contact).filter(Contact.id.in_(data.contact_ids)).all()
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    n_invoices = db.query(func.count(Invoice.id)).filter(Invoice.project_id == project_id).scalar() or 0
    n_time_entries = db.query(func.count(TimeEntry.id)).filter(TimeEntry.project_id == project_id).scalar() or 0
    if n_invoices or n_time_entries:
        parts = []
        if n_invoices:
            parts.append(f"{n_invoices} invoice{'s' if n_invoices != 1 else ''}")
        if n_time_entries:
            parts.append(f"{n_time_entries} time entr{'ies' if n_time_entries != 1 else 'y'}")
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete this project: it has {', '.join(parts)}. Delete these first.",
        )

    db.delete(project)
    db.commit()


@router.get("/{project_id}/tasks", response_model=List[TaskOut])
def get_project_tasks(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .order_by(Task.status, Task.position)
        .all()
    )


@router.get("/{project_id}/kanban")
def get_kanban(project_id: int, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .order_by(Task.position)
        .all()
    )
    columns = ["backlog", "todo", "in_progress", "review", "waiting_client", "delivered"]
    board = {col: [] for col in columns}
    for task in tasks:
        col = task.status if task.status in board else "backlog"
        board[col].append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "task_type": task.task_type,
            "is_revision": task.is_revision,
            "estimate_hours": float(task.estimate_hours or 0),
            "position": task.position,
        })
    return board
