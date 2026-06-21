from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Proposal, ProposalLineItem, Project, Contact
from ..schemas import ProposalCreate, ProposalOut, ProposalUpdate, ProjectOut

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _recalculate(proposal: Proposal):
    subtotal = sum(
        (item.qty or 0) * (item.rate or 0)
        for item in proposal.line_items
    )
    discount = proposal.discount or Decimal("0")
    tax_rate = proposal.tax_rate or Decimal("0")
    after_discount = subtotal - discount
    total = after_discount + (after_discount * tax_rate / 100)
    proposal.subtotal = subtotal
    proposal.total = total


def _auto_expire(db: Session):
    """Mark proposals with a lapsed valid_until as expired (only non-terminal statuses)."""
    today = date.today()
    db.query(Proposal).filter(
        Proposal.valid_until != None,  # noqa: E711
        Proposal.valid_until < today,
        Proposal.status.in_(["draft", "sent", "viewed"]),
    ).update({"status": "expired"}, synchronize_session=False)
    db.commit()


@router.get("", response_model=List[ProposalOut])
def list_proposals(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    _auto_expire(db)
    q = db.query(Proposal)
    if status:
        q = q.filter(Proposal.status == status)
    if client_id:
        q = q.filter(Proposal.client_id == client_id)
    return q.order_by(Proposal.created_at.desc()).all()


@router.post("", response_model=ProposalOut, status_code=201)
def create_proposal(data: ProposalCreate, db: Session = Depends(get_db)):
    items = data.line_items
    contact_ids = data.contact_ids
    proposal_data = data.model_dump(exclude={"line_items", "contact_ids"})
    proposal = Proposal(**proposal_data)
    db.add(proposal)
    db.flush()
    for item in items:
        li = ProposalLineItem(**item.model_dump(), proposal_id=proposal.id)
        db.add(li)
    if contact_ids:
        proposal.contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
    db.flush()
    db.refresh(proposal)
    _recalculate(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(proposal_id: int, data: ProposalUpdate, db: Session = Depends(get_db)):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    update_data = data.model_dump(exclude_none=True, exclude={"line_items", "contact_ids"})
    for k, v in update_data.items():
        setattr(proposal, k, v)

    if data.line_items is not None:
        db.query(ProposalLineItem).filter(ProposalLineItem.proposal_id == proposal_id).delete()
        for item in data.line_items:
            li = ProposalLineItem(**item.model_dump(), proposal_id=proposal.id)
            db.add(li)
        db.flush()
        db.refresh(proposal)

    proposal.contacts = db.query(Contact).filter(Contact.id.in_(data.contact_ids)).all()

    _recalculate(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    db.delete(proposal)
    db.commit()


# ── Status transitions ──────────────────────────────────────────────────────

def _get_proposal_or_404(proposal_id: int, db: Session) -> Proposal:
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return p


@router.patch("/{proposal_id}/mark-sent", response_model=ProposalOut)
def mark_proposal_sent(proposal_id: int, db: Session = Depends(get_db)):
    proposal = _get_proposal_or_404(proposal_id, db)
    proposal.status = "sent"
    db.commit()
    db.refresh(proposal)
    return proposal


@router.patch("/{proposal_id}/mark-viewed", response_model=ProposalOut)
def mark_proposal_viewed(proposal_id: int, db: Session = Depends(get_db)):
    proposal = _get_proposal_or_404(proposal_id, db)
    proposal.status = "viewed"
    db.commit()
    db.refresh(proposal)
    return proposal


@router.patch("/{proposal_id}/mark-accepted", response_model=ProposalOut)
def mark_proposal_accepted(proposal_id: int, db: Session = Depends(get_db)):
    proposal = _get_proposal_or_404(proposal_id, db)
    proposal.status = "accepted"
    db.commit()
    db.refresh(proposal)
    return proposal


@router.patch("/{proposal_id}/mark-rejected", response_model=ProposalOut)
def mark_proposal_rejected(proposal_id: int, db: Session = Depends(get_db)):
    proposal = _get_proposal_or_404(proposal_id, db)
    proposal.status = "rejected"
    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/convert-to-project", response_model=ProjectOut)
def convert_to_project(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.project:
        # Return existing project instead of erroring — frontend will redirect to it
        return proposal.project

    project = Project(
        name=proposal.title,
        client_id=proposal.client_id,
        proposal_id=proposal.id,
        budget=proposal.total,
        currency=proposal.currency or "USD",
        description=proposal.description,
        status="active",
    )
    proposal.status = "accepted"
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
