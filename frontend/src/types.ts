export interface Client {
  id: number
  name: string
  company_name: string
  logo?: string
  vat_id?: string
  address?: string
  country?: string
  email: string
  phone?: string
  website?: string
  notes?: string
  tags?: string
  status: 'lead' | 'active' | 'inactive' | 'archived'
  created_at?: string
  contacts: Contact[]
}

export interface Contact {
  id: number
  client_id: number
  name: string
  position?: string
  email: string
  phone?: string
  avatar?: string
  is_primary: boolean
}

export interface ProposalLineItem {
  id: number
  proposal_id: number
  name: string
  qty: number
  rate: number
  amount: number
}

export interface Proposal {
  id: number
  title: string
  client_id: number
  description?: string
  pricing_model: string
  discount: number
  tax_rate: number
  currency: string
  subtotal: number
  total: number
  notes?: string
  terms?: string
  valid_until?: string
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
  revision_rounds: number
  timeline?: string
  milestones?: string
  created_at?: string
  line_items: ProposalLineItem[]
  client?: Client
  contacts: Contact[]
}

export interface Project {
  id: number
  name: string
  client_id: number
  proposal_id?: number
  project_type?: string
  description?: string
  budget: number
  currency: string
  start_date?: string
  deadline?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  revision_rounds_included: number
  revision_rounds_used: number
  progress_pct?: number
  created_at?: string
  client?: Client
  contacts: Contact[]
}

export interface Task {
  id: number
  project_id: number
  title: string
  description?: string
  status: string
  due_date?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimate_hours: number
  task_type: 'design' | 'revision' | 'admin'
  is_revision: boolean
  revision_number: number
  position: number
  created_at?: string
}

export interface Attachment {
  id: number
  invoice_id?: number
  payment_id?: number
  expense_id?: number
  filename: string
  size: number
  created_at?: string
}

export interface TimeEntry {
  id: number
  project_id: number
  task_id?: number
  date: string
  duration_minutes: number
  notes?: string
  billable: boolean
  created_at?: string
}

export interface InvoiceLineItem {
  id: number
  invoice_id: number
  name: string
  qty: number
  rate: number
  amount: number
}

export interface Invoice {
  id: number
  invoice_number: string
  client_id: number
  project_id?: number
  issue_date: string
  due_date: string
  currency: string
  discount: number
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  notes?: string
  terms?: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
  created_at?: string
  line_items: InvoiceLineItem[]
  client?: Client
  contacts: Contact[]
}

export interface PaymentAllocation {
  id: number
  payment_id: number
  invoice_id: number
  amount: number
}

export interface Payment {
  id: number
  invoice_id?: number
  date: string
  amount: number
  currency: string
  method?: string
  fee: number
  notes?: string
  status: 'pending' | 'cleared'
  created_at?: string
  allocations?: PaymentAllocation[]
}

export interface Expense {
  id: number
  date: string
  amount: number
  currency: string
  category?: string
  vendor?: string
  description?: string
  tax_vat: number
  tax_deductible: boolean
  project_id?: number
  created_at?: string
}

export interface AppSettings {
  id: number
  business_name: string
  business_email: string
  business_phone: string
  business_address: string
  business_website: string
  vat_id: string
  default_currency: string
  default_tax_rate: number
  invoice_number_format: string
  payment_details: string
  default_terms: string
  owner_name?: string
  position?: string
  avatar?: string
  must_change_password?: boolean
}

export interface Reminder {
  id: number
  title: string
  notes?: string
  priority: 'low' | 'medium' | 'high'
  due_date: string
  client_id?: number
  client?: Client
  created_at?: string
}

export interface DashboardStats {
  active_projects: number
  invoices_pending_amount: number
  proposals_sent: number
  pending_quotes: number
  revenue_this_month: number
  expenses_this_month: number
  profit_this_month: number
  outstanding_invoices: number
  overdue_invoices: number
  revenue_ytd: number
  profit_ytd: number
}
