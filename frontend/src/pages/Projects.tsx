import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, ExternalLink, Trash2, Pencil, AlertCircle, X } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { projectsApi, clientsApi } from '../api'
import type { Project, Client } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ClientPicker from '../components/ui/ClientPicker'
import { useSettings } from '../context/SettingsContext'

const STATUS_OPTIONS = ['active', 'paused', 'completed', 'archived']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']

interface ProjectFormData {
  name: string
  client_id: number
  contact_ids: number[]
  proposal_id?: number | null
  project_type?: string
  description?: string
  budget: number
  currency: string
  start_date?: string
  deadline?: string
  status: string
  revision_rounds_included: number
}

export default function Projects() {
  const qc = useQueryClient()
  const { defaultCurrency } = useSettings()
  const [statusFilter, setStatusFilter] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Project | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsApi.list({ ...(statusFilter && { status: statusFilter }) }),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: showModal,
  })

  const defaultValues: ProjectFormData = {
    name: '', client_id: 0, contact_ids: [], budget: 0,
    revision_rounds_included: 2, currency: defaultCurrency, status: 'active',
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<ProjectFormData>({
    defaultValues,
  })

  const watchedClientId = watch('client_id')
  const watchedContactIds = watch('contact_ids')
  const selectedClient = clients.find(c => c.id === watchedClientId)

  const closeModal = () => { setShowModal(false); setEditingItem(null); reset(defaultValues) }

  const createMut = useMutation({
    mutationFn: (data: unknown) => projectsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => projectsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setDeleteError(err?.response?.data?.detail ?? 'Delete failed. Please try again.'),
  })

  const openEdit = (p: Project) => {
    setEditingItem(p)
    reset({
      name: p.name,
      client_id: p.client_id,
      contact_ids: p.contacts?.map(c => c.id) ?? [],
      proposal_id: p.proposal_id ?? null,
      project_type: p.project_type ?? '',
      description: p.description ?? '',
      budget: p.budget,
      currency: p.currency,
      start_date: p.start_date ?? '',
      deadline: p.deadline ?? '',
      status: p.status,
      revision_rounds_included: p.revision_rounds_included,
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

  const onSubmit = (data: ProjectFormData) => {
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all your design projects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-brand-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-300'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-1">No projects yet</p>
          <p className="text-sm">Create a project or convert an accepted proposal</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {p.client && (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      {p.client.logo
                        ? <img src={p.client.logo} alt="" className="w-full h-full object-cover" />
                        : <span className="text-white font-bold text-xs">{p.client.company_name.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.client?.company_name ?? `Client #${p.client_id}`}</p>
                  </div>
                </div>
                <Badge label={p.status} variant={statusBadgeVariant(p.status)} className="ml-2 flex-shrink-0" />
              </div>

              {p.project_type && (
                <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-3">
                  {p.project_type}
                </span>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Budget</span>
                  <span className="font-medium">{p.currency} {Number(p.budget).toLocaleString()}</span>
                </div>
                {p.deadline && (
                  <div className="flex justify-between text-gray-600">
                    <span>Deadline</span>
                    <span className="font-medium">
                      {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Revisions</span>
                  <span className="font-medium">{p.revision_rounds_used}/{p.revision_rounds_included}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Progress</span>
                  <span className="text-xs font-medium text-gray-500">{p.progress_pct ?? 0}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                    style={{ width: `${p.progress_pct ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Stacked contact avatars */}
              {p.contacts && p.contacts.length > 0 && (
                <div
                  className="flex items-center mt-3"
                  title={
                    p.contacts.length === 1
                      ? p.contacts[0].name
                      : `${p.contacts[0].name} and ${p.contacts.length - 1} other${p.contacts.length - 1 > 1 ? 's' : ''}`
                  }
                >
                  {p.contacts.slice(0, 4).map((c, i) => (
                    <div
                      key={c.id}
                      className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-brand-400 flex items-center justify-center border-2 border-white flex-shrink-0"
                      style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: 4 - i }}
                    >
                      {c.avatar
                        ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                        : <span className="text-white font-bold text-[8px] leading-none">{c.name.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                  ))}
                  {p.contacts.length > 4 && (
                    <div
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white flex-shrink-0 text-[9px] font-semibold text-gray-500"
                      style={{ marginLeft: '-6px', zIndex: 0 }}
                    >
                      +{p.contacts.length - 4}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <Link to={`/projects/${p.id}`} className="text-brand-500 text-sm font-medium flex items-center gap-1 hover:text-brand-700">
                  <ExternalLink size={13} /> Open
                </Link>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-600">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteMut.mutate(p.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editingItem ? 'Edit Project' : 'New Project'} onClose={closeModal} size="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Project Name *</label>
              <input {...register('name', { required: true })} className="input" placeholder="Brand Identity Design" />
            </div>

            {/* Fancy client picker */}
            <div>
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

            {/* Contact persons */}
            {selectedClient && selectedClient.contacts.length > 0 && (
              <div>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <input {...register('project_type')} className="input" placeholder="Branding, UI, Logo..." />
              </div>
              <div>
                <label className="label">Status</label>
                <select {...register('status')} className="input">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Budget</label>
                <input {...register('budget', { valueAsNumber: true })} type="number" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="label">Currency</label>
                <select {...register('currency')} className="input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Date</label>
                <input {...register('start_date')} type="date" className="input" />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input {...register('deadline')} type="date" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Revision Rounds</label>
                <input {...register('revision_rounds_included', { valueAsNumber: true })} type="number" min="0" className="input" />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea {...register('description')} className="input resize-none" rows={3} />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
