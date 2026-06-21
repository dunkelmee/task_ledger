from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# Alias to avoid Pydantic v2 annotation shadowing: when a field is named 'date'
# and its annotation references 'date', Pydantic re-evaluates the annotation
# with the class namespace as localns — where 'date' == None (the default) —
# turning Optional[date] into Optional[None]. _Date sidesteps this.
_Date = date


# ── Contact ────────────────────────────────────────────────────────────────

class ContactBase(BaseModel):
    name: str
    position: Optional[str] = None
    email: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_primary: bool = False

class ContactCreate(ContactBase):
    pass

class ContactUpdate(ContactBase):
    name: Optional[str] = None
    email: Optional[str] = None

class ContactOut(ContactBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int


# ── Client ─────────────────────────────────────────────────────────────────

class ClientBase(BaseModel):
    name: str
    company_name: str
    logo: Optional[str] = None
    vat_id: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    status: str = "lead"

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None

class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None
    contacts: List[ContactOut] = []


# ── Proposal line items ────────────────────────────────────────────────────

class ProposalLineItemBase(BaseModel):
    name: str
    qty: Decimal = Decimal("1")
    rate: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")

class ProposalLineItemCreate(ProposalLineItemBase):
    pass

class ProposalLineItemOut(ProposalLineItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    proposal_id: int


# ── Proposal ───────────────────────────────────────────────────────────────

class ProposalBase(BaseModel):
    title: str
    client_id: int
    description: Optional[str] = None
    pricing_model: str = "fixed"
    discount: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")
    currency: str = "USD"
    notes: Optional[str] = None
    terms: Optional[str] = None
    valid_until: Optional[date] = None
    revision_rounds: int = 1
    timeline: Optional[str] = None
    milestones: Optional[str] = None

class ProposalCreate(ProposalBase):
    line_items: List[ProposalLineItemCreate] = []
    contact_ids: List[int] = []

class ProposalUpdate(ProposalBase):
    title: Optional[str] = None
    client_id: Optional[int] = None
    status: Optional[str] = None
    line_items: Optional[List[ProposalLineItemCreate]] = None
    contact_ids: List[int] = []

class ProposalOut(ProposalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subtotal: Decimal
    total: Decimal
    status: str
    created_at: Optional[datetime] = None
    line_items: List[ProposalLineItemOut] = []
    client: Optional[ClientOut] = None
    contacts: List[ContactOut] = []


# ── Project ────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    name: str
    client_id: int
    proposal_id: Optional[int] = None
    project_type: Optional[str] = None
    description: Optional[str] = None
    budget: Decimal = Decimal("0")
    currency: str = "USD"
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    status: str = "active"
    revision_rounds_included: int = 2

class ProjectCreate(ProjectBase):
    contact_ids: List[int] = []

class ProjectUpdate(ProjectBase):
    name: Optional[str] = None
    client_id: Optional[int] = None
    revision_rounds_used: Optional[int] = None
    contact_ids: List[int] = []

class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    revision_rounds_used: int
    progress_pct: int = 0
    created_at: Optional[datetime] = None
    client: Optional[ClientOut] = None
    contacts: List[ContactOut] = []


# ── Task ───────────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    project_id: int
    title: str
    description: Optional[str] = None
    status: str = "backlog"
    due_date: Optional[date] = None
    priority: str = "medium"
    estimate_hours: Decimal = Decimal("0")
    task_type: str = "design"
    is_revision: bool = False
    revision_number: int = 0
    position: int = 0

class TaskCreate(TaskBase):
    pass

class TaskUpdate(TaskBase):
    project_id: Optional[int] = None
    title: Optional[str] = None

class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None


# ── Time Entry ─────────────────────────────────────────────────────────────

class TimeEntryBase(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    date: date
    duration_minutes: int = 0
    notes: Optional[str] = None
    billable: bool = True

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(TimeEntryBase):
    project_id: Optional[int] = None
    date: Optional[_Date] = None

class TimeEntryOut(TimeEntryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None


# ── Invoice line items ─────────────────────────────────────────────────────

class InvoiceLineItemBase(BaseModel):
    name: str
    qty: Decimal = Decimal("1")
    rate: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemOut(InvoiceLineItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int


# ── Invoice ────────────────────────────────────────────────────────────────

class InvoiceBase(BaseModel):
    client_id: int
    project_id: Optional[int] = None
    issue_date: date
    due_date: date
    currency: str = "USD"
    discount: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")
    notes: Optional[str] = None
    terms: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    line_items: List[InvoiceLineItemCreate] = []
    contact_ids: List[int] = []

class InvoiceUpdate(InvoiceBase):
    client_id: Optional[int] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    line_items: Optional[List[InvoiceLineItemCreate]] = None
    contact_ids: List[int] = []

class InvoiceOut(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_number: str
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    status: str
    created_at: Optional[datetime] = None
    line_items: List[InvoiceLineItemOut] = []
    client: Optional[ClientOut] = None
    contacts: List[ContactOut] = []


# ── Payment Allocation ─────────────────────────────────────────────────────

class PaymentAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payment_id: int
    invoice_id: int
    amount: Decimal


# ── Payment ────────────────────────────────────────────────────────────────

class PaymentBase(BaseModel):
    invoice_id: Optional[int] = None
    date: date
    amount: Decimal
    currency: str = "USD"
    method: Optional[str] = None
    fee: Decimal = Decimal("0")
    notes: Optional[str] = None
    status: str = "cleared"

class PaymentCreate(PaymentBase):
    # For multi-invoice allocation: list of {invoice_id, amount}
    invoice_ids: List[int] = []

class PaymentUpdate(BaseModel):
    """All-optional PATCH-style update; only provided fields are applied."""
    invoice_id: Optional[int] = None
    date: Optional[_Date] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    method: Optional[str] = None
    fee: Optional[Decimal] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    invoice_ids: Optional[List[int]] = None

class PaymentOut(PaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None
    allocations: List[PaymentAllocationOut] = []


# ── Expense ────────────────────────────────────────────────────────────────

class ExpenseBase(BaseModel):
    date: date
    amount: Decimal
    currency: str = "USD"
    category: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    tax_vat: Decimal = Decimal("0")
    tax_deductible: bool = False
    project_id: Optional[int] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    """All-optional PATCH-style update; only provided fields are applied."""
    date: Optional[_Date] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    tax_vat: Optional[Decimal] = None
    tax_deductible: Optional[bool] = None
    project_id: Optional[int] = None

class ExpenseOut(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None


# ── Reminder ───────────────────────────────────────────────────────────────

class ReminderBase(BaseModel):
    title: str
    notes: Optional[str] = None
    priority: str = "medium"
    due_date: date
    client_id: Optional[int] = None

class ReminderCreate(ReminderBase):
    pass

class ReminderUpdate(ReminderBase):
    title: Optional[str] = None
    due_date: Optional[date] = None

class ReminderOut(ReminderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None
    client: Optional[ClientOut] = None


# ── App Settings ───────────────────────────────────────────────────────────

class AppSettingsBase(BaseModel):
    business_name: str = ""
    business_email: str = ""
    business_phone: str = ""
    business_address: str = ""
    business_website: str = ""
    vat_id: str = ""
    default_currency: str = "USD"
    default_tax_rate: Decimal = Decimal("0")
    invoice_number_format: str = "INV-{year}-{seq:04d}"
    payment_details: str = ""
    default_terms: str = ""
    owner_name: str = ""
    position: str = ""
    avatar: str = ""

class AppSettingsUpdate(AppSettingsBase):
    pass

class AppSettingsOut(AppSettingsBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    must_change_password: bool = True


# ── Auth ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    must_change_password: bool

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ── Attachment ──────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: Optional[int] = None
    payment_id: Optional[int] = None
    expense_id: Optional[int] = None
    filename: str
    size: int
    created_at: Optional[datetime] = None


# ── Dashboard ──────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    active_projects: int
    invoices_pending_amount: Decimal
    proposals_sent: int
    pending_quotes: int
    revenue_this_month: Decimal
    expenses_this_month: Decimal
    profit_this_month: Decimal
    outstanding_invoices: int
    overdue_invoices: int
    revenue_ytd: Decimal
    profit_ytd: Decimal

class RevenueDataPoint(BaseModel):
    label: str
    revenue: float

class ProposalChartData(BaseModel):
    sent: int
    accepted: int
    total: int

class ProjectProgress(BaseModel):
    id: int
    name: str
    client_name: str
    deadline: Optional[date]
    status: str
    progress_pct: int


# ── Exchange Rates ──────────────────────────────────────────────────────────

class ExchangeRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_currency: str
    target_currency: str
    rate: Decimal
    rate_date: date
    fetched_at: Optional[datetime] = None


class ExchangeRateMap(BaseModel):
    """Flat map of target_currency → rate (base is always EUR)."""
    base: str
    date: date
    rates: dict[str, float]
