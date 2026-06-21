from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client, Contact, Invoice, Payment, Proposal, Project
from ..schemas import (
    ClientCreate, ClientOut, ClientUpdate,
    ContactCreate, ContactOut, ContactUpdate
)

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=List[ClientOut])
def list_clients(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Client)
    if status:
        q = q.filter(Client.status == status)
    if search:
        q = q.filter(
            Client.name.ilike(f"%{search}%") |
            Client.company_name.ilike(f"%{search}%") |
            Client.email.ilike(f"%{search}%")
        )
    return q.order_by(Client.name).all()


@router.post("", response_model=ClientOut, status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(client, k, v)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    n_projects = db.query(func.count(Project.id)).filter(Project.client_id == client_id).scalar() or 0
    n_invoices = db.query(func.count(Invoice.id)).filter(Invoice.client_id == client_id).scalar() or 0
    n_proposals = db.query(func.count(Proposal.id)).filter(Proposal.client_id == client_id).scalar() or 0
    if n_projects or n_invoices or n_proposals:
        parts = []
        if n_projects:
            parts.append(f"{n_projects} project{'s' if n_projects != 1 else ''}")
        if n_invoices:
            parts.append(f"{n_invoices} invoice{'s' if n_invoices != 1 else ''}")
        if n_proposals:
            parts.append(f"{n_proposals} proposal{'s' if n_proposals != 1 else ''}")
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete this client: they have {', '.join(parts)}. Delete or reassign these first.",
        )

    db.delete(client)
    db.commit()


# ── Contacts ───────────────────────────────────────────────────────────────

@router.get("/{client_id}/contacts", response_model=List[ContactOut])
def list_contacts(client_id: int, db: Session = Depends(get_db)):
    return db.query(Contact).filter(Contact.client_id == client_id).all()


@router.post("/{client_id}/contacts", response_model=ContactOut, status_code=201)
def create_contact(client_id: int, data: ContactCreate, db: Session = Depends(get_db)):
    contact = Contact(**data.model_dump(), client_id=client_id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{client_id}/contacts/{contact_id}", response_model=ContactOut)
def update_contact(client_id: int, contact_id: int, data: ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(
        Contact.id == contact_id, Contact.client_id == client_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{client_id}/contacts/{contact_id}", status_code=204)
def delete_contact(client_id: int, contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(
        Contact.id == contact_id, Contact.client_id == client_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()


# ── Client summary ─────────────────────────────────────────────────────────

@router.get("/{client_id}/summary")
def client_summary(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    total_revenue = (
        db.query(func.sum(Payment.amount))
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .filter(Invoice.client_id == client_id, Payment.status == "cleared")
        .scalar()
    ) or 0

    outstanding = (
        db.query(func.sum(Invoice.total))
        .filter(Invoice.client_id == client_id, Invoice.status.in_(["sent", "viewed", "partially_paid", "overdue"]))
        .scalar()
    ) or 0

    return {
        "total_revenue": float(total_revenue),
        "outstanding_balance": float(outstanding),
        "project_count": len(client.projects),
        "invoice_count": len(client.invoices),
        "proposal_count": len(client.proposals),
    }
