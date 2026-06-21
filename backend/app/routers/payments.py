from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Payment, PaymentAllocation, Invoice
from ..schemas import PaymentCreate, PaymentOut, PaymentUpdate
from .auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _update_invoice_status(invoice: Invoice, db: Session) -> None:
    """Recalculate and update the payment status of an invoice."""
    total_paid = (
        db.query(func.sum(PaymentAllocation.amount))
        .filter(
            PaymentAllocation.invoice_id == invoice.id,
        )
        .scalar()
    ) or Decimal("0")
    if total_paid >= invoice.total:
        invoice.status = "paid"
    elif total_paid > 0:
        invoice.status = "partially_paid"


@router.get("", response_model=List[PaymentOut])
def list_payments(
    invoice_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    q = db.query(Payment)
    if invoice_id:
        q = q.join(PaymentAllocation).filter(PaymentAllocation.invoice_id == invoice_id)
    return q.order_by(Payment.date.desc()).all()


@router.post("", response_model=PaymentOut, status_code=201)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    # Exclude invoice_ids from the model fields
    payment_data = data.model_dump(exclude={"invoice_ids"})
    payment = Payment(**payment_data)
    db.add(payment)
    db.flush()

    invoice_ids = data.invoice_ids
    # Fallback: if invoice_ids empty but legacy invoice_id provided, treat as single allocation
    if not invoice_ids and data.invoice_id:
        invoice_ids = [data.invoice_id]

    if invoice_ids:
        per_invoice = data.amount / Decimal(len(invoice_ids))
        for inv_id in invoice_ids:
            alloc = PaymentAllocation(payment_id=payment.id, invoice_id=inv_id, amount=per_invoice)
            db.add(alloc)
            db.flush()
            invoice = db.query(Invoice).filter(Invoice.id == inv_id).first()
            if invoice:
                _update_invoice_status(invoice, db)

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Update basic fields, excluding invoice_ids (handled separately)
    update_dict = data.model_dump(exclude_none=True, exclude={"invoice_ids"})
    for k, v in update_dict.items():
        setattr(payment, k, v)

    # Handle re-allocation when invoice_ids is explicitly provided
    if data.invoice_ids is not None:
        # Remove old allocations
        db.query(PaymentAllocation).filter(PaymentAllocation.payment_id == payment.id).delete()
        db.flush()
        # Create new allocations
        if data.invoice_ids:
            total_amount = payment.amount
            per_invoice = total_amount / Decimal(len(data.invoice_ids))
            for inv_id in data.invoice_ids:
                alloc = PaymentAllocation(
                    payment_id=payment.id,
                    invoice_id=inv_id,
                    amount=per_invoice,
                )
                db.add(alloc)
                db.flush()
                invoice = db.query(Invoice).filter(Invoice.id == inv_id).first()
                if invoice:
                    _update_invoice_status(invoice, db)

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
