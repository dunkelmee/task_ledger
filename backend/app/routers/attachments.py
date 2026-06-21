import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Attachment
from ..schemas import AttachmentOut

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads")
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.get("", response_model=List[AttachmentOut])
def list_attachments(
    invoice_id: Optional[int] = None,
    payment_id: Optional[int] = None,
    expense_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if invoice_id is None and payment_id is None and expense_id is None:
        raise HTTPException(status_code=400, detail="Provide invoice_id, payment_id, or expense_id")
    q = db.query(Attachment)
    if invoice_id is not None:
        q = q.filter(Attachment.invoice_id == invoice_id)
    elif payment_id is not None:
        q = q.filter(Attachment.payment_id == payment_id)
    else:
        q = q.filter(Attachment.expense_id == expense_id)
    return q.order_by(Attachment.created_at.asc()).all()


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    file: UploadFile = File(...),
    invoice_id: Optional[int] = Query(None),
    payment_id: Optional[int] = Query(None),
    expense_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    if invoice_id is None and payment_id is None and expense_id is None:
        raise HTTPException(status_code=400, detail="Provide invoice_id, payment_id, or expense_id")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)
    with open(filepath, "wb") as f:
        f.write(content)

    att = Attachment(
        invoice_id=invoice_id,
        payment_id=payment_id,
        expense_id=expense_id,
        filename=file.filename,
        filepath=filepath,
        size=len(content),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{att_id}/download")
def download_attachment(att_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(att.filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(att.filepath, media_type="application/pdf", filename=att.filename)


@router.delete("/{att_id}", status_code=204)
def delete_attachment(att_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if os.path.exists(att.filepath):
        os.remove(att.filepath)
    db.delete(att)
    db.commit()
