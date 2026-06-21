from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client, Invoice, Payment, Expense, Project, Proposal, Task
from ..schemas import DashboardStats, RevenueDataPoint, ProposalChartData, ProjectProgress
from .auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    today = date.today()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    active_projects = db.query(func.count(Project.id)).filter(Project.status == "active").scalar() or 0

    pending_amount = (
        db.query(func.sum(Invoice.total))
        .filter(Invoice.status.in_(["sent", "viewed", "partially_paid", "overdue"]))
        .scalar()
    ) or Decimal("0")

    proposals_sent = (
        db.query(func.count(Proposal.id))
        .filter(Proposal.status.in_(["sent", "viewed", "accepted", "rejected"]))
        .scalar()
    ) or 0

    pending_quotes = (
        db.query(func.count(Proposal.id))
        .filter(Proposal.status == "draft")
        .scalar()
    ) or 0

    revenue_month = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.status == "cleared", Payment.date >= month_start)
        .scalar()
    ) or Decimal("0")

    expenses_month = (
        db.query(func.sum(Expense.amount))
        .filter(Expense.date >= month_start)
        .scalar()
    ) or Decimal("0")

    profit_month = revenue_month - expenses_month

    outstanding = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status.in_(["sent", "viewed", "partially_paid"]))
        .scalar()
    ) or 0

    overdue = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status == "overdue")
        .scalar()
    ) or 0

    revenue_ytd = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.status == "cleared", Payment.date >= year_start)
        .scalar()
    ) or Decimal("0")

    expenses_ytd = (
        db.query(func.sum(Expense.amount))
        .filter(Expense.date >= year_start)
        .scalar()
    ) or Decimal("0")

    profit_ytd = revenue_ytd - expenses_ytd

    return DashboardStats(
        active_projects=active_projects,
        invoices_pending_amount=pending_amount,
        proposals_sent=proposals_sent,
        pending_quotes=pending_quotes,
        revenue_this_month=revenue_month,
        expenses_this_month=expenses_month,
        profit_this_month=profit_month,
        outstanding_invoices=outstanding,
        overdue_invoices=overdue,
        revenue_ytd=revenue_ytd,
        profit_ytd=profit_ytd,
    )


@router.get("/revenue-chart")
def revenue_chart(
    period: str = "year",
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    today = date.today()
    points = []

    if period == "month":
        # Last 30 days, daily bars
        for i in range(29, -1, -1):
            d = today - timedelta(days=i)
            total = (
                db.query(func.sum(Payment.amount))
                .filter(Payment.date == d, Payment.status == "cleared")
                .scalar()
            ) or 0
            points.append({"label": d.strftime("%b %d"), "revenue": float(total)})

    elif period == "quarter":
        # Last 12 weeks, weekly bars
        for i in range(11, -1, -1):
            week_end = today - timedelta(weeks=i)
            week_start = week_end - timedelta(days=6)
            total = (
                db.query(func.sum(Payment.amount))
                .filter(
                    Payment.date >= week_start,
                    Payment.date <= week_end,
                    Payment.status == "cleared",
                )
                .scalar()
            ) or 0
            points.append({"label": f"W{week_end.strftime('%m/%d')}", "revenue": float(total)})

    else:
        # year — last 12 months, monthly bars
        for i in range(11, -1, -1):
            month = today.month - i
            year = today.year
            while month <= 0:
                month += 12
                year -= 1
            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)
            total = (
                db.query(func.sum(Payment.amount))
                .filter(
                    Payment.date >= month_start,
                    Payment.date <= month_end,
                    Payment.status == "cleared",
                )
                .scalar()
            ) or 0
            points.append({"label": month_start.strftime("%b"), "revenue": float(total)})

    return points


@router.get("/proposal-chart", response_model=ProposalChartData)
def proposal_chart(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    sent = (
        db.query(func.count(Proposal.id))
        .filter(Proposal.status.in_(["sent", "viewed", "accepted", "rejected", "expired"]))
        .scalar()
    ) or 0
    accepted = (
        db.query(func.count(Proposal.id))
        .filter(Proposal.status == "accepted")
        .scalar()
    ) or 0
    return ProposalChartData(sent=sent, accepted=accepted, total=sent)


@router.get("/project-progress")
def project_progress(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    projects = (
        db.query(Project)
        .filter(Project.status == "active")
        .limit(10)
        .all()
    )
    # Weight each kanban stage proportionally toward completion
    STATUS_WEIGHTS = {
        "backlog": 0.0, "todo": 0.1, "in_progress": 0.4,
        "review": 0.8, "waiting_client": 0.9, "delivered": 1.0,
    }

    result = []
    for p in projects:
        tasks = p.tasks
        total_tasks = len(tasks)
        if total_tasks:
            weighted = sum(STATUS_WEIGHTS.get(t.status, 0.0) for t in tasks)
            pct = min(100, int(weighted / total_tasks * 100))
        elif p.start_date and p.deadline and p.start_date < p.deadline:
            # No tasks yet — fall back to time elapsed between start and deadline
            total_days = (p.deadline - p.start_date).days
            elapsed = (date.today() - p.start_date).days
            pct = max(0, min(100, int(elapsed / total_days * 100)))
        else:
            pct = 0

        if p.deadline:
            days_left = (p.deadline - date.today()).days
            if days_left < 0:
                health = "delayed"
            elif days_left < 7:
                health = "at_risk"
            else:
                health = "on_track"
        else:
            health = "on_track"

        result.append({
            "id": p.id,
            "name": p.name,
            "client_name": p.client.name if p.client else "",
            "deadline": p.deadline.isoformat() if p.deadline else None,
            "status": health,
            "progress_pct": pct,
        })
    return result
