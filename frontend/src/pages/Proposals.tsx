import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowRight, Pencil, Send, Eye, CheckCircle, XCircle } from 'lucide-react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { proposalsApi, clientsApi } from '../api'
import type { Proposal, Client } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ClientPicker from '../components/ui/ClientPicker'
import { useSettings } from '../context/SettingsContext'

const STATUS_OPTIONS = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']

interface ProposalFormData {
  title: string
  client_id: number
  contact_ids: number[]
  description: string
  pricing_model: string
  currency: string
  discount: number
  tax_rate: number
  notes: string
  terms: string
  valid_until: string
  revision_rounds: number
  line_items: { name: string; qty: number; rate: number; amount: number }[]
}

export default function Proposals() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { defaultCurrency } = useSettings()
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Proposal | null>(null)

  const { data: proposals = [] } = useQuery<Proposal[]>({
    queryKey: ['proposals', statusFilter],
    queryFn: () => proposalsApi.list({ ...(statusFilter && { status: statusFilter }) }),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: showModal,
  })

  const defaultFormValues: ProposalFormData = {
    title: '', client_id: 0, contact_ids: [], description: '', pricing_model: 'fixed',
    currency: defaultCurrency, discount: 0, tax_rate: 0, notes: '', terms: '', valid_until: '',
    revision_rounds: 1, line_items: [{ name: '', qty: 1, rate: 0, amount: 0 }],
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<ProposalFormData>({
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
    mutationFn: (data: unknown) => proposalsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => proposalsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => proposalsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  const convertMut = useMutation({
    mutationFn: (id: number) => proposalsApi.convertToProject(id),
    onSuccess: (project: { id: number }) => {
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${project.id}`)
    },
  })

  const markSentMut = useMutation({
    mutationFn: (id: number) => proposalsApi.markSent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  const markViewedMut = useMutation({
    mutationFn: (id: number) => proposalsApi.markViewed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  const markAcceptedMut = useMutation({
    mutationFn: (id: number) => proposalsApi.markAccepted(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  const markRejectedMut = useMutation({
    mutationFn: (id: number) => proposalsApi.markRejected(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  const openEdit = (p: Proposal) => {
    setEditingItem(p)
    reset({
      title: p.title,
      client_id: p.client_id,
      contact_ids: p.contacts?.map(c => c.id) ?? [],
      description: p.description ?? '',
      pricing_model: p.pricing_model ?? 'fixed',
      currency: p.currency ?? defaultCurrency,
      discount: Number(p.discount ?? 0),
      tax_rate: Number(p.tax_rate ?? 0),
      notes: p.notes ?? '',
      terms: p.terms ?? '',
      valid_until: p.valid_until ?? '',
      revision_rounds: p.revision_rounds ?? 1,
      line_items: (p.line_items as { name: string; qty: number; rate: number; amount: number }[]) ?? [{ name: '', qty: 1, rate: 0, amount: 0 }],
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

  const onSubmit = (data: ProposalFormData) => {
    if (editingItem) updateMut.mutate({ id: editingItem.id, data })
    else createMut.mutate(data)
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and send project proposals</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Proposal
        </button>
      </div>

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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
              <th className="px-5 py-3.5 font-medium">Title</th>
              <th className="px-5 py-3.5 font-medium">Client</th>
              <th className="px-5 py-3.5 font-medium">Total</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Valid Until</th>
              <th className="px-5 py-3.5 font-medium">Transitions</th>
              <th className="px-5 py-3.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-10 text-sm">No proposals yet.</td>
              </tr>
            )}
            {proposals.map(p => (
              <tr key={p.id} className="table-row">
                <td className="px-5 py-3.5 font-medium text-gray-800">{p.title}</td>
                <td className="px-5 py-3.5">
                  {p.client ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        {p.client.logo
                          ? <img src={p.client.logo} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-xs">{p.client.company_name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <span className="text-gray-600">{p.client.company_name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Client #{p.client_id}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-semibold text-gray-800">
                  {p.currency ?? 'USD'} {Number(p.total).toLocaleString()}
                </td>
                <td className="px-5 py-3.5">
                  <Badge label={p.status} variant={statusBadgeVariant(p.status)} />
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.status === 'draft' && (
                      <button
                        onClick={() => markSentMut.mutate(p.id)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap"
                        title="Mark as sent"
                      >
                        <Send size={11} /> Mark sent
                      </button>
                    )}
                    {p.status === 'sent' && (
                      <button
                        onClick={() => markViewedMut.mutate(p.id)}
                        className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 font-medium whitespace-nowrap"
                        title="Mark as viewed"
                      >
                        <Eye size={11} /> Mark viewed
                      </button>
                    )}
                    {p.status === 'viewed' && (
                      <>
                        <button
                          onClick={() => markAcceptedMut.mutate(p.id)}
                          className="flex items-center gap-1 text-xs text-green-500 hover:text-green-700 font-medium whitespace-nowrap"
                          title="Mark as accepted"
                        >
                          <CheckCircle size={11} /> Accept
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => markRejectedMut.mutate(p.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium whitespace-nowrap"
                          title="Mark as rejected"
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {p.status === 'accepted' && (
                      <button
                        onClick={() => convertMut.mutate(p.id)}
                        className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-medium whitespace-nowrap"
                        title="Go to project"
                        disabled={convertMut.isPending}
                      >
                        <ArrowRight size={11} /> To project
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-600">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteMut.mutate(p.id)} className="text-red-400 hover:text-red-600">
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

      {/* Create / Edit modal */}
      {showModal && (
        <Modal title={editingItem ? 'Edit Proposal' : 'New Proposal'} onClose={closeModal} size="xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Title *</label>
                <input {...register('title', { required: true })} className="input" placeholder="Website Redesign Proposal" />
              </div>

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
                <label className="label">Pricing Model</label>
                <select {...register('pricing_model')} className="input">
                  {['fixed', 'hourly', 'package'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Currency</label>
                <select {...register('currency')} className="input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Valid Until</label>
                <input {...register('valid_until')} type="date" className="input" />
              </div>
              <div>
                <label className="label">Revision Rounds</label>
                <input {...register('revision_rounds', { valueAsNumber: true })} type="number" min="0" className="input" />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea {...register('description')} className="input resize-none" rows={3} />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Line Items</label>
                <button
                  type="button"
                  onClick={() => append({ name: '', qty: 1, rate: 0, amount: 0 })}
                  className="text-xs text-brand-500 font-medium flex items-center gap-1"
                >
                  <Plus size={13} /> Add item
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
                  <span className="col-span-5">Description</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-3">Rate</span>
                  <span className="col-span-1" />
                </div>
                {fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
                    <input {...register(`line_items.${i}.name`)} placeholder="Item name" className="input col-span-5 text-sm py-1.5" />
                    <input {...register(`line_items.${i}.qty`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input col-span-2 text-sm py-1.5" />
                    <input {...register(`line_items.${i}.rate`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input col-span-3 text-sm py-1.5" />
                    <button type="button" onClick={() => remove(i)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Discount</label>
                <input {...register('discount', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Tax Rate (%)</label>
                <input {...register('tax_rate', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
            </div>

            <div>
              <label className="label">Terms & Conditions</label>
              <textarea {...register('terms')} className="input resize-none" rows={2} />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Proposal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
