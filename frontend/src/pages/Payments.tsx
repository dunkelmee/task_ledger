import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Paperclip } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { paymentsApi, invoicesApi } from '../api'
import { useSettings } from '../context/SettingsContext'
import type { Payment, Invoice } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import AttachmentsModal from '../components/ui/AttachmentsModal'

const METHODS = ['bank', 'paypal', 'stripe', 'cash', 'check', 'crypto', 'other']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']
const STATUS_OPTIONS = ['cleared', 'pending']

interface PaymentFormData {
  date: string
  amount: number
  currency: string
  method: string
  fee: number
  status: string
  notes: string
}

export default function Payments() {
  const qc = useQueryClient()
  const { defaultCurrency } = useSettings()
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Payment | null>(null)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [attachmentsPayment, setAttachmentsPayment] = useState<Payment | null>(null)

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.list(),
  })

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })

  const defaultFormValues: PaymentFormData = {
    date: '', amount: 0, currency: defaultCurrency, method: '', fee: 0, status: 'cleared', notes: '',
  }

  const { register, handleSubmit, reset } = useForm<PaymentFormData>({
    defaultValues: defaultFormValues,
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setSelectedInvoiceIds([])
    reset(defaultFormValues)
  }

  const createMut = useMutation({
    mutationFn: (data: unknown) => paymentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      closeModal()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => paymentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      closeModal()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => paymentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const openEdit = (p: Payment) => {
    setEditingItem(p)
    const currentAllocationIds = (p.allocations ?? []).map(a => a.invoice_id)
    setSelectedInvoiceIds(currentAllocationIds)
    reset({
      date: p.date ?? '',
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? defaultCurrency,
      method: p.method ?? '',
      fee: Number(p.fee ?? 0),
      status: p.status ?? 'cleared',
      notes: p.notes ?? '',
    })
    setShowModal(true)
  }

  const onSubmit = (data: PaymentFormData) => {
    const payload = {
      date: data.date || null,
      // Sanitize numeric fields — NaN from empty inputs becomes 0
      amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
      currency: data.currency,
      method: data.method || null,
      fee: isNaN(Number(data.fee)) ? 0 : Number(data.fee),
      status: data.status,
      notes: data.notes || null,
      invoice_ids: selectedInvoiceIds,
    }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const toggleInvoice = (id: number) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const invoiceMap = useMemo(
    () => Object.fromEntries(invoices.map(inv => [inv.id, inv])),
    [invoices]
  )

  // For new payments: show unpaid invoices; for edit: also include already-associated invoices
  const availableInvoices = useMemo(() => {
    const editAssociatedIds = editingItem ? (editingItem.allocations ?? []).map(a => a.invoice_id) : []
    return editingItem
      ? invoices.filter(i => !['paid', 'cancelled'].includes(i.status) || editAssociatedIds.includes(i.id))
      : invoices.filter(i => !['paid', 'cancelled'].includes(i.status))
  }, [invoices, editingItem])

  const totalCleared = useMemo(
    () => payments.filter(p => p.status === 'cleared').reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  )

  // Build invoice balance summary: flatten allocations once, then derive per-invoice balances
  const invoiceBalances = useMemo(() => {
    const allAllocations = payments.flatMap(p => p.allocations ?? [])
    const invoiceIds = new Set(allAllocations.map(a => a.invoice_id))
    return invoices
      .filter(inv => invoiceIds.has(inv.id))
      .map(inv => {
        const totalPaid = allAllocations
          .filter(a => a.invoice_id === inv.id)
          .reduce((s, a) => s + Number(a.amount), 0)
        return { inv, totalPaid, balance: Number(inv.total) - totalPaid }
      })
  }, [invoices, payments])

  // Apply status filter to payments list
  const filteredPayments = useMemo(
    () => statusFilter ? payments.filter(p => p.status === statusFilter) : payments,
    [payments, statusFilter]
  )

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all received payments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main payments table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Status filter */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input max-w-[180px]"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[550px]">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3.5 font-medium">Invoice(s)</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium">Method</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-10">No payments recorded yet.</td></tr>
                )}
                {filteredPayments.map(p => {
                  const allocations = p.allocations ?? []
                  const primaryInv = allocations.length > 0
                    ? invoiceMap[allocations[0].invoice_id]
                    : (p.invoice_id ? invoiceMap[p.invoice_id] : undefined)
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-5 py-3.5">
                        {allocations.length > 0 ? (
                          <div>
                            {allocations.map(a => (
                              <p key={a.invoice_id} className="font-mono text-xs text-gray-500">
                                {invoiceMap[a.invoice_id]?.invoice_number ?? `#${a.invoice_id}`}
                              </p>
                            ))}
                            <p className="text-xs text-gray-400">{primaryInv?.client?.name}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-mono text-xs text-gray-500">
                              {primaryInv?.invoice_number ?? (p.invoice_id ? `#${p.invoice_id}` : '—')}
                            </p>
                            <p className="text-xs text-gray-400">{primaryInv?.client?.name}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-gray-800">
                        {p.currency} {Number(p.amount).toLocaleString()}
                        {Number(p.fee) > 0 && (
                          <span className="block text-xs font-normal text-gray-400">fee: -{Number(p.fee).toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 capitalize">{p.method || '—'}</td>
                      <td className="px-5 py-3.5">
                        <Badge label={p.status} variant={statusBadgeVariant(p.status)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAttachmentsPayment(p)} title="Attachments" className="text-gray-400 hover:text-brand-500">
                            <Paperclip size={14} />
                          </button>
                          <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-600">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteMut.mutate(p.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
            <p className="text-sm text-green-600 font-medium">Total Cleared</p>
            <p className="text-3xl font-bold text-green-700 mt-1">
              {defaultCurrency} {totalCleared.toLocaleString()}
            </p>
          </div>

          {invoiceBalances.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Invoice Balances</h3>
              <div className="space-y-3">
                {invoiceBalances.map(({ inv, totalPaid, balance }) => (
                  <div key={inv.id} className="text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gray-500">{inv.invoice_number}</span>
                      <Badge
                        label={inv.status.replace('_', ' ')}
                        variant={statusBadgeVariant(inv.status)}
                      />
                    </div>
                    <div className="flex items-center justify-between text-gray-500">
                      <span>Invoice total</span>
                      <span className="font-medium text-gray-700">{inv.currency} {Number(inv.total).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500">
                      <span>Paid</span>
                      <span className="font-medium text-green-600">{inv.currency} {totalPaid.toLocaleString()}</span>
                    </div>
                    {balance > 0.01 && (
                      <div className="flex items-center justify-between text-gray-500 border-t border-gray-100 pt-1">
                        <span>Balance due</span>
                        <span className="font-semibold text-red-500">{inv.currency} {balance.toLocaleString()}</span>
                      </div>
                    )}
                    {balance < -0.01 && (
                      /* Overpaid */
                      <div className="flex items-center justify-between text-gray-500 border-t border-gray-100 pt-1">
                        <span>Balance due</span>
                        <span className="font-semibold text-red-600">
                          Overpaid ({inv.currency} {Math.abs(balance).toLocaleString()})
                        </span>
                      </div>
                    )}
                    {balance >= -0.01 && balance <= 0.01 && (
                      <div className="flex items-center justify-between text-gray-500 border-t border-gray-100 pt-1">
                        <span>Balance due</span>
                        <span className="font-semibold text-green-600">Paid in full</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {attachmentsPayment && (
        <AttachmentsModal
          paymentId={attachmentsPayment.id}
          label={`Payment #${attachmentsPayment.id}`}
          onClose={() => setAttachmentsPayment(null)}
        />
      )}

      {showModal && (
        <Modal title={editingItem ? 'Edit Payment' : 'Record Payment'} onClose={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Invoice selection — shown for both create and edit */}
            <div>
              <label className="label">Link to Invoice(s)</label>
              {availableInvoices.length === 0 ? (
                <p className="text-sm text-gray-400">No unpaid invoices.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {availableInvoices.map(inv => (
                    <label key={inv.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(inv.id)}
                        onChange={() => toggleInvoice(inv.id)}
                        className="rounded"
                      />
                      <span className="font-mono text-xs text-gray-500">{inv.invoice_number}</span>
                      <span className="text-sm text-gray-700 flex-1">{inv.client?.name}</span>
                      <span className="text-sm font-medium text-gray-800">{inv.currency} {Number(inv.total).toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input {...register('date', { required: true })} type="date" className="input" />
              </div>
              <div>
                <label className="label">Amount *</label>
                <input {...register('amount', { required: true, valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Currency</label>
                <select {...register('currency')} className="input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select {...register('method')} className="input">
                  <option value="">Select method</option>
                  {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fee</label>
                <input {...register('fee', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Status</label>
                <select {...register('status')} className="input">
                  <option value="cleared">Cleared</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea {...register('notes')} className="input resize-none" rows={2} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
