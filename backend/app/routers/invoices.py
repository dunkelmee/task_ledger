from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, InvoiceLineItem, AppSettings, PaymentAllocation, Contact
from ..schemas import InvoiceCreate, InvoiceOut, InvoiceUpdate

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _next_invoice_number(db: Session) -> str:
    settings = db.query(AppSettings).first()
    fmt = "INV-{year}-{seq:04d}"
    if settings:
        fmt = settings.invoice_number_format or fmt

    year = date.today().year
    count = db.query(func.count(Invoice.id)).scalar() + 1
    try:
        return fmt.format(year=year, seq=count)
    except Exception:
        return f"INV-{year}-{count:04d}"


def _recalculate(invoice: Invoice):
    subtotal = sum((item.qty or 0) * (item.rate or 0) for item in invoice.line_items)
    discount = invoice.discount or Decimal("0")
    tax_rate = invoice.tax_rate or Decimal("0")
    after_discount = subtotal - discount
    tax_amount = after_discount * tax_rate / 100
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total = after_discount + tax_amount


@router.get("", response_model=List[InvoiceOut])
def list_invoices(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Invoice)
    if status:
        q = q.filter(Invoice.status == status)
    if client_id:
        q = q.filter(Invoice.client_id == client_id)
    if project_id:
        q = q.filter(Invoice.project_id == project_id)
    return q.order_by(Invoice.created_at.desc()).all()


@router.post("", response_model=InvoiceOut, status_code=201)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    items = data.line_items
    contact_ids = data.contact_ids
    invoice_data = data.model_dump(exclude={"line_items", "contact_ids"})
    invoice = Invoice(**invoice_data, invoice_number=_next_invoice_number(db))
    db.add(invoice)
    db.flush()
    for item in items:
        li = InvoiceLineItem(**item.model_dump(), invoice_id=invoice.id)
        db.add(li)
    if contact_ids:
        invoice.contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
    db.flush()
    db.refresh(invoice)
    _recalculate(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: int, data: InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = data.model_dump(exclude_none=True, exclude={"line_items", "contact_ids"})
    for k, v in update_data.items():
        setattr(invoice, k, v)

    if data.line_items is not None:
        db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice_id).delete()
        for item in data.line_items:
            li = InvoiceLineItem(**item.model_dump(), invoice_id=invoice.id)
            db.add(li)
        db.flush()
        db.refresh(invoice)

    invoice.contacts = db.query(Contact).filter(Contact.id.in_(data.contact_ids)).all()

    _recalculate(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    n_payments = db.query(func.count(PaymentAllocation.id)).filter(PaymentAllocation.invoice_id == invoice_id).scalar() or 0
    if n_payments:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete this invoice: it has {n_payments} payment{'s' if n_payments != 1 else ''} applied. Remove the payments first.",
        )

    db.delete(invoice)
    db.commit()


@router.patch("/{invoice_id}/send")
def send_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = "sent"
    db.commit()
    return {"ok": True, "status": "sent"}


@router.patch("/{invoice_id}/mark-paid")
def mark_paid(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = "paid"
    db.commit()
    return {"ok": True, "status": "paid"}
