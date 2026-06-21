import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Send, Pencil, Paperclip, AlertCircle, X } from 'lucide-react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { invoicesApi, clientsApi, projectsApi } from '../api'
import type { Invoice, Client, Project } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import AttachmentsModal from '../components/ui/AttachmentsModal'
import ClientPicker from '../components/ui/ClientPicker'
import { useSettings } from '../context/SettingsContext'

const STATUS_OPTIONS = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']

interface InvoiceFormData {
  client_id: number
  contact_ids: number[]
  project_id?: number | null
  issue_date: string
  due_date: string
  currency: string
  discount: number
  tax_rate: number
  notes: string
  terms: string
  line_items: { name: string; qty: number; rate: number; amount: number }[]
}

export default function Invoices() {
  const qc = useQueryClient()
  const { defaultCurrency } = useSettings()
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Invoice | null>(null)
  const [attachmentsInvoice, setAttachmentsInvoice] = useState<Invoice | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesApi.list({ ...(statusFilter && { status: statusFilter }) }),
  })

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['clients'], queryFn: () => clientsApi.list(), enabled: showModal })
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: () => projectsApi.list(), enabled: showModal })

  const defaultFormValues: InvoiceFormData = {
    client_id: 0, contact_ids: [], project_id: null, issue_date: '', due_date: '',
    currency: defaultCurrency, discount: 0, tax_rate: 0, notes: '', terms: '',
    line_items: [{ name: '', qty: 1, rate: 0, amount: 0 }],
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<InvoiceFormData>({
    defaultValues: defaultFormValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const watchedClientId = watch('client_id')
  const watchedContactIds = watch('contact_ids')
  const selectedClient = clients.find(c => c.id === watchedClientId)

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    reset(defaultFormValues)
  }

  const createMut = useMutation({
    mutationFn: (data: unknown) => invoicesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => invoicesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setDeleteError(err?.response?.data?.detail ?? 'Delete failed. Please try again.'),
  })

  const sendMut = useMutation({
    mutationFn: (id: number) => invoicesApi.send(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const openEdit = (inv: Invoice) => {
    setEditingItem(inv)
    reset({
      client_id: inv.client_id,
      contact_ids: inv.contacts?.map(c => c.id) ?? [],
      project_id: inv.project_id ?? null,
      issue_date: inv.issue_date ?? '',
      due_date: inv.due_date ?? '',
      currency: inv.currency ?? defaultCurrency,
      discount: Number(inv.discount ?? 0),
      tax_rate: Number(inv.tax_rate ?? 0),
      notes: inv.notes ?? '',
      terms: inv.terms ?? '',
      line_items: (inv.line_items as { name: string; qty: number; rate: number; amount: number }[]) ?? [{ name: '', qty: 1, rate: 0, amount: 0 }],
    })
    setShowModal(true)
  }

  const toggleContact = (contactId: number) => {
    const current = watchedContactIds ?? []
    setValue(
      'contact_ids',
      current.includes(contactId) ? current.filter(id => id !== contactId) : [...current, contactId],
    )
  }

  const onSubmit = (data: InvoiceFormData) => {
    if (editingItem) updateMut.mutate({ id: editingItem.id, data })
    else createMut.mutate(data)
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage billing and payments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input max-w-[200px]"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
              <th className="px-5 py-3.5 font-medium">#</th>
              <th className="px-5 py-3.5 font-medium">Client</th>
              <th className="px-5 py-3.5 font-medium">Total</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Due Date</th>
              <th className="px-5 py-3.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-10">No invoices yet.</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="table-row">
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                <td className="px-5 py-3.5">
                  {inv.client ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        {inv.client.logo
                          ? <img src={inv.client.logo} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-xs">{inv.client.company_name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <span className="font-medium text-gray-800">{inv.client.company_name}</span>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-800">Client #{inv.client_id}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-bold text-gray-800">{inv.currency} {Number(inv.total).toLocaleString()}</td>
                <td className="px-5 py-3.5">
                  <Badge label={inv.status.replace('_', ' ')} variant={statusBadgeVariant(inv.status)} />
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {inv.status === 'draft' && (
                      <button onClick={() => sendMut.mutate(inv.id)} title="Mark as sent" className="text-blue-400 hover:text-blue-600">
                        <Send size={14} />
                      </button>
                    )}
                    <button onClick={() => setAttachmentsInvoice(inv)} title="Attachments" className="text-gray-400 hover:text-brand-500">
                      <Paperclip size={14} />
                    </button>
                    <button onClick={() => openEdit(inv)} className="text-gray-400 hover:text-gray-600">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteMut.mutate(inv.id)} className="text-red-400 hover:text-red-600">
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

      {/* Attachments modal */}
      {attachmentsInvoice && (
        <AttachmentsModal
          invoiceId={attachmentsInvoice.id}
          label={attachmentsInvoice.invoice_number}
          onClose={() => setAttachmentsInvoice(null)}
        />
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <Modal title={editingItem ? 'Edit Invoice' : 'New Invoice'} onClose={closeModal} size="xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              {/* Fancy client picker */}
              <div className="col-span-2">
                <label className="label">Client *</label>
                <Controller
                  control={control}
                  name="client_id"
                  rules={{ validate: v => v > 0 || 'Please select a client' }}
                  render={({ field }) => (
                    <ClientPicker
                      clients={clients}
                      value={field.value}
                      onChange={id => {
                        field.onChange(id)
                        setValue('contact_ids', [])
                      }}
                    />
                  )}
                />
              </div>

              {/* Contact persons (only shown when a client with contacts is selected) */}
              {selectedClient && selectedClient.contacts.length > 0 && (
                <div className="col-span-2">
                  <label className="label">Contact Persons</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.contacts.map(contact => {
                      const isSelected = (watchedContactIds ?? []).includes(contact.id)
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => toggleContact(contact.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-brand-300 bg-white'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-brand-400 flex items-center justify-center flex-shrink-0">
                            {contact.avatar
                              ? <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                              : <span className="text-white font-bold text-[8px]">{contact.name.charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <span>{contact.name}</span>
                          {contact.position && <span className="opacity-70">· {contact.position}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Project</label>
                <select
                  {...register('project_id', { setValueAs: (v: string) => v === '' ? null : Number(v) })}
                  className="input"
                >
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Currency</label>
                <select {...register('currency')} className="input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Issue Date *</label>
                <input {...register('issue_date', { required: true })} type="date" className="input" />
              </div>
              <div>
                <label className="label">Due Date *</label>
                <input {...register('due_date', { required: true })} type="date" className="input" />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Line Items</label>
                <button type="button" onClick={() => append({ name: '', qty: 1, rate: 0, amount: 0 })} className="text-xs text-brand-500 font-medium flex items-center gap-1">
                  <Plus size={13} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
                    <input {...register(`line_items.${i}.name`)} placeholder="Description" className="input col-span-5 text-sm py-1.5" />
                    <input {...register(`line_items.${i}.qty`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input col-span-2 text-sm py-1.5" placeholder="Qty" />
                    <input {...register(`line_items.${i}.rate`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input col-span-3 text-sm py-1.5" placeholder="Rate" />
                    <button type="button" onClick={() => remove(i)} className="col-span-1 text-red-400 flex justify-center"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Discount ($)</label>
                <input {...register('discount', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Tax Rate (%)</label>
                <input {...register('tax_rate', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea {...register('notes')} className="input resize-none" rows={2} />
            </div>
            <div>
              <label className="label">Terms</label>
              <textarea {...register('terms')} className="input resize-none" rows={2} />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
