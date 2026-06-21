from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Table, Text, func
)
from sqlalchemy.orm import relationship
from .database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255))
    vat_id = Column(String(100))
    address = Column(Text)
    country = Column(String(100))
    email = Column(String(255))
    phone = Column(String(50))
    logo = Column(Text)
    website = Column(String(255))
    notes = Column(Text)
    tags = Column(String(500))  # comma-separated
    status = Column(
        Enum("lead", "active", "inactive", "archived", name="client_status"),
        default="lead"
    )
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="client")
    projects = relationship("Project", back_populates="client")
    invoices = relationship("Invoice", back_populates="client")
    reminders = relationship("Reminder", back_populates="client")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    name = Column(String(255), nullable=False)
    position = Column(String(100), name="position")
    email = Column(String(255))
    phone = Column(String(50))
    avatar = Column(Text)
    is_primary = Column(Boolean, default=False)

    client = relationship("Client", back_populates="contacts")


_proposal_contacts = Table(
    "proposal_contacts",
    Base.metadata,
    Column("proposal_id", Integer, ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
)


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    description = Column(Text)
    pricing_model = Column(
        Enum("fixed", "hourly", "package", name="pricing_model"),
        default="fixed"
    )
    discount = Column(Numeric(10, 2), default=0)
    tax_rate = Column(Numeric(5, 2), default=0)
    currency = Column(String(10), default="USD")
    subtotal = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    terms = Column(Text)
    valid_until = Column(Date)
    status = Column(
        Enum("draft", "sent", "viewed", "accepted", "rejected", "expired", name="proposal_status"),
        default="draft"
    )
    revision_rounds = Column(Integer, default=1)
    timeline = Column(String(255))
    milestones = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="proposals")
    line_items = relationship("ProposalLineItem", back_populates="proposal", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="proposal", uselist=False)
    contacts = relationship("Contact", secondary=_proposal_contacts)


class ProposalLineItem(Base):
    __tablename__ = "proposal_line_items"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    name = Column(String(255), nullable=False)
    qty = Column(Numeric(10, 2), default=1)
    rate = Column(Numeric(10, 2), default=0)
    amount = Column(Numeric(10, 2), default=0)

    proposal = relationship("Proposal", back_populates="line_items")


_project_contacts = Table(
    "project_contacts",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=True)
    project_type = Column(String(100))
    description = Column(Text)
    budget = Column(Numeric(10, 2), default=0)
    currency = Column(String(10), default="USD")
    start_date = Column(Date)
    deadline = Column(Date)
    status = Column(
        Enum("active", "paused", "completed", "archived", name="project_status"),
        default="active"
    )
    revision_rounds_included = Column(Integer, default=2)
    revision_rounds_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="projects")
    proposal = relationship("Proposal", back_populates="project")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="project")
    expenses = relationship("Expense", back_populates="project")
    time_entries = relationship("TimeEntry", back_populates="project")
    contacts = relationship("Contact", secondary=_project_contacts)

    _STATUS_WEIGHTS = {
        "backlog": 0.0, "todo": 0.1, "in_progress": 0.4,
        "review": 0.8, "waiting_client": 0.9, "delivered": 1.0,
    }

    @property
    def progress_pct(self) -> int:
        tasks = self.tasks
        total = len(tasks)
        if total:
            weighted = sum(self._STATUS_WEIGHTS.get(t.status, 0.0) for t in tasks)
            return min(100, int(weighted / total * 100))
        if self.start_date and self.deadline and self.start_date < self.deadline:
            total_days = (self.deadline - self.start_date).days
            elapsed = (date.today() - self.start_date).days
            return max(0, min(100, int(elapsed / total_days * 100)))
        return 0


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="backlog")
    due_date = Column(Date)
    priority = Column(
        Enum("low", "medium", "high", "urgent", name="task_priority"),
        default="medium"
    )
    estimate_hours = Column(Numeric(10, 2), default=0)
    task_type = Column(
        Enum("design", "revision", "admin", name="task_type"),
        default="design"
    )
    is_revision = Column(Boolean, default=False)
    revision_number = Column(Integer, default=0)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    time_entries = relationship("TimeEntry", back_populates="task")


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    date = Column(Date, nullable=False)
    duration_minutes = Column(Integer, default=0)
    notes = Column(Text)
    billable = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    task = relationship("Task", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")


_invoice_contacts = Table(
    "invoice_contacts",
    Base.metadata,
    Column("invoice_id", Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    currency = Column(String(10), default="USD")
    discount = Column(Numeric(10, 2), default=0)
    tax_rate = Column(Numeric(5, 2), default=0)
    subtotal = Column(Numeric(10, 2), default=0)
    tax_amount = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    terms = Column(Text)
    status = Column(
        Enum(
            "draft", "sent", "viewed", "paid",
            "partially_paid", "overdue", "cancelled",
            name="invoice_status"
        ),
        default="draft"
    )
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="invoices")
    project = relationship("Project", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", foreign_keys="Payment.invoice_id")
    allocations = relationship("PaymentAllocation", back_populates="invoice")
    attachments = relationship("Attachment", back_populates="invoice", cascade="all, delete-orphan")
    contacts = relationship("Contact", secondary=_invoice_contacts)


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    name = Column(String(255), nullable=False)
    qty = Column(Numeric(10, 2), default=1)
    rate = Column(Numeric(10, 2), default=0)
    amount = Column(Numeric(10, 2), default=0)

    invoice = relationship("Invoice", back_populates="line_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    # Kept for backward-compat; nullable for multi-invoice payments
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    date = Column(Date, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="USD")
    method = Column(String(50))
    fee = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    status = Column(
        Enum("pending", "cleared", name="payment_status"),
        default="cleared"
    )
    created_at = Column(DateTime, default=func.now())

    invoice = relationship("Invoice", back_populates="payments", foreign_keys=[invoice_id])
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    """Junction table: one payment can cover portions of multiple invoices."""
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)

    payment = relationship("Payment", back_populates="allocations")
    invoice = relationship("Invoice", back_populates="allocations")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="USD")
    category = Column(String(100))
    vendor = Column(String(255))
    description = Column(String(500))
    tax_vat = Column(Numeric(10, 2), default=0)
    tax_deductible = Column(Boolean, default=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())

    project = relationship("Project", back_populates="expenses")
    attachments = relationship("Attachment", back_populates="expense", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    notes = Column(Text)
    priority = Column(
        Enum("low", "medium", "high", name="reminder_priority"),
        default="medium"
    )
    due_date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())

    client = relationship("Client", back_populates="reminders")


class ExchangeRate(Base):
    """Daily exchange rates fetched from Frankfurter (stored so live API calls are not needed)."""
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    base_currency = Column(String(10), nullable=False, default="EUR")
    target_currency = Column(String(10), nullable=False)
    rate = Column(Numeric(18, 8), nullable=False)
    rate_date = Column(Date, nullable=False)
    fetched_at = Column(DateTime, default=func.now())


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    business_name = Column(String(255), default="")
    business_email = Column(String(255), default="")
    business_phone = Column(String(50), default="")
    business_address = Column(Text, default="")
    business_website = Column(String(255), default="")
    vat_id = Column(String(100), default="")
    default_currency = Column(String(10), default="USD")
    default_tax_rate = Column(Numeric(5, 2), default=0)
    invoice_number_format = Column(String(100), default="INV-{year}-{seq:04d}")
    payment_details = Column(Text, default="")
    default_terms = Column(Text, default="")
    owner_name = Column(String(255), default="")
    position = Column(String(255), default="")
    avatar = Column(Text, default="")  # base64-encoded image
    password_hash = Column(String(255), default="")
    must_change_password = Column(Boolean, default=True)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=True)
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    size = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

    invoice = relationship("Invoice", back_populates="attachments")
    payment = relationship("Payment", back_populates="attachments")
    expense = relationship("Expense", back_populates="attachments")
