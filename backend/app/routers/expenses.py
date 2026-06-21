from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Expense
from ..schemas import ExpenseCreate, ExpenseOut, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    project_id: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Expense)
    if project_id:
        q = q.filter(Expense.project_id == project_id)
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.date.desc()).all()


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db)):
    expense = Expense(**data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, data: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(expense, k, v)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
