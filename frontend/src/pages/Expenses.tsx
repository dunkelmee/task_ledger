import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Paperclip, AlertCircle, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { expensesApi, projectsApi } from '../api'
import type { Expense, Project } from '../types'
import Modal from '../components/ui/Modal'
import AttachmentsModal from '../components/ui/AttachmentsModal'
import { useSettings } from '../context/SettingsContext'

const CATEGORIES = ['software', 'hardware', 'office', 'marketing', 'education', 'travel', 'other']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']

const CATEGORY_COLORS: Record<string, string> = {
  software: 'bg-blue-100 text-blue-700',
  hardware: 'bg-gray-100 text-gray-700',
  office: 'bg-green-100 text-green-700',
  marketing: 'bg-pink-100 text-pink-700',
  education: 'bg-purple-100 text-purple-700',
  travel: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-500',
}

type ExpenseForm = Omit<Expense, 'id' | 'created_at'>

export default function Expenses() {
  const qc = useQueryClient()
  const { defaultCurrency } = useSettings()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [taxDeductibleOnly, setTaxDeductibleOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Expense | null>(null)
  const [attachmentsExpense, setAttachmentsExpense] = useState<Expense | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: rawExpenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses', categoryFilter],
    queryFn: () => expensesApi.list({ ...(categoryFilter && { category: categoryFilter }) }),
  })

  const expenses = useMemo(
    () => taxDeductibleOnly ? rawExpenses.filter((e: Expense) => e.tax_deductible) : rawExpenses,
    [rawExpenses, taxDeductibleOnly]
  )

  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: () => projectsApi.list(), enabled: showModal })

  const defaultFormValues: Partial<ExpenseForm> = { currency: defaultCurrency, tax_deductible: false, tax_vat: 0 }

  const { register, handleSubmit, reset } = useForm<ExpenseForm>({
    defaultValues: defaultFormValues,
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    reset(defaultFormValues as ExpenseForm)
  }

  const createMut = useMutation({
    mutationFn: (data: unknown) => expensesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => expensesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setDeleteError(err?.response?.data?.detail ?? 'Delete failed. Please try again.'),
  })

  const openEdit = (e: Expense) => {
    setEditingItem(e)
    reset({
      date: e.date ?? '',
      amount: Number(e.amount ?? 0),
      currency: e.currency ?? defaultCurrency,
      category: e.category ?? '',
      vendor: e.vendor ?? '',
      description: e.description ?? '',
      tax_vat: Number(e.tax_vat ?? 0),
      tax_deductible: e.tax_deductible ?? false,
      project_id: e.project_id ?? undefined,
    })
    setShowModal(true)
  }

  const onSubmit = (data: ExpenseForm) => {
    const payload = {
      ...data,
      date: data.date || null,
      amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
      tax_vat: isNaN(Number(data.tax_vat)) ? 0 : Number(data.tax_vat),
      project_id: data.project_id || null,
    }
    if (editingItem) updateMut.mutate({ id: editingItem.id, data: payload })
    else createMut.mutate(payload)
  }

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  )

  const byCategory = useMemo(
    () => CATEGORIES.map(cat => ({
      cat,
      total: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    })).filter(c => c.total > 0),
    [expenses]
  )

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-5">
      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your business expenses</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main expenses table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Category filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="input max-w-[200px]"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={taxDeductibleOnly}
                onChange={e => setTaxDeductibleOnly(e.target.checked)}
                className="rounded accent-brand-500"
              />
              Tax deductible only
            </label>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Description</th>
                  <th className="px-5 py-3.5 font-medium">Category</th>
                  <th className="px-5 py-3.5 font-medium">Vendor</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-10">No expenses yet.</td></tr>
                )}
                {expenses.map(e => (
                  <tr key={e.id} className="table-row">
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800">{e.description || '—'}</p>
                      {e.tax_deductible && <span className="text-xs text-green-600 font-medium">Tax deductible</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {e.category && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide [font-variant:small-caps] ${CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e.category}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{e.vendor || '—'}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-800">{e.currency} {Number(e.amount).toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAttachmentsExpense(e)} className="text-gray-400 hover:text-brand-500" title="Attachments">
                          <Paperclip size={14} />
                        </button>
                        <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-gray-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteMut.mutate(e.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="card bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100">
            <p className="text-sm text-rose-600 font-medium">Total Expenses</p>
            <p className="text-3xl font-bold text-rose-700 mt-1">{defaultCurrency} {totalExpenses.toLocaleString()}</p>
          </div>

          {byCategory.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">By Category</h3>
              <div className="space-y-2">
                {byCategory.sort((a, b) => b.total - a.total).map(({ cat, total }) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full tracking-wide [font-variant:small-caps] ${CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                      {cat}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{defaultCurrency} {total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {attachmentsExpense && (
        <AttachmentsModal
          expenseId={attachmentsExpense.id}
          label={attachmentsExpense.description || attachmentsExpense.vendor || `Expense #${attachmentsExpense.id}`}
          onClose={() => setAttachmentsExpense(null)}
        />
      )}

      {showModal && (
        <Modal title={editingItem ? 'Edit Expense' : 'Add Expense'} onClose={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <label className="label">Category</label>
                <select {...register('category')} className="input">
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Vendor</label>
              <input {...register('vendor')} className="input" placeholder="Vendor name" />
            </div>
            <div>
              <label className="label">Description</label>
              <input {...register('description')} className="input" placeholder="What was this for?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tax/VAT</label>
                <input {...register('tax_vat', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Link to Project</label>
                <select {...register('project_id', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })} className="input">
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input {...register('tax_deductible')} type="checkbox" className="rounded" />
              Tax deductible
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
