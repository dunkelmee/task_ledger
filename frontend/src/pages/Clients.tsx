import { useState, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Trash2, ExternalLink, Pencil,
  AlertCircle, X, ChevronDown, ChevronUp, UserPlus,
} from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { clientsApi } from '../api'
import type { Client, Contact } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ImageUpload from '../components/ui/ImageUpload'

const STATUS_OPTIONS = ['lead', 'active', 'inactive', 'archived']

const STATUS_TEXT_COLOR: Record<string, string> = {
  lead: 'text-blue-500',
  active: 'text-green-600',
  inactive: 'text-gray-400',
  archived: 'text-gray-300',
}

// ── Form types ─────────────────────────────────────────────────────────────

interface ContactFormFields {
  name: string
  position: string
  email: string
  phone: string
  avatar: string
}

interface ClientCreateForm {
  company_name: string
  logo: string
  email: string
  phone: string
  status: string
  contacts: ContactFormFields[]
}

interface ClientEditForm {
  company_name: string
  logo: string
  email: string
  phone: string
  status: string
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Clients() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [addContactForClient, setAddContactForClient] = useState<Client | null>(null)
  const [editingContact, setEditingContact] = useState<{ client: Client; contact: Contact } | null>(null)

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const toggleExpand = (id: number) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // ── Data ────────────────────────────────────────────────────────────────

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients', deferredSearch, statusFilter],
    queryFn: () => clientsApi.list({
      ...(deferredSearch && { search: deferredSearch }),
      ...(statusFilter && { status: statusFilter }),
    }),
  })

  // ── Mutations ───────────────────────────────────────────────────────────

  const deleteClientMut = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setDeleteError(err?.response?.data?.detail ?? 'Delete failed. Please try again.'),
  })

  const updateClientMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => clientsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setEditingClient(null) },
  })

  const createContactMut = useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: unknown }) =>
      clientsApi.createContact(clientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setAddContactForClient(null) },
  })

  const updateContactMut = useMutation({
    mutationFn: ({ clientId, contactId, data }: { clientId: number; contactId: number; data: unknown }) =>
      clientsApi.updateContact(clientId, contactId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setEditingContact(null) },
  })

  const deleteContactMut = useMutation({
    mutationFn: ({ clientId, contactId }: { clientId: number; contactId: number }) =>
      clientsApi.deleteContact(clientId, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  // ── Create client form (with contacts) ──────────────────────────────────

  const createForm = useForm<ClientCreateForm>({
    defaultValues: {
      company_name: '', logo: '', email: '', phone: '', status: 'lead',
      contacts: [{ name: '', position: '', email: '', phone: '', avatar: '' }],
    },
  })
  const { fields: contactFields, append, remove } = useFieldArray({
    control: createForm.control,
    name: 'contacts',
  })

  const onCreateSubmit = async (data: ClientCreateForm) => {
    const newClient = await clientsApi.create({
      name: data.company_name,
      company_name: data.company_name,
      logo: data.logo || null,
      email: data.email,
      phone: data.phone || null,
      status: data.status,
    })
    for (const c of data.contacts) {
      if (!c.name.trim() || !c.email.trim()) continue
      await clientsApi.createContact(newClient.id, {
        name: c.name,
        position: c.position || null,
        email: c.email,
        phone: c.phone || null,
        avatar: c.avatar || null,
        is_primary: false,
      })
    }
    qc.invalidateQueries({ queryKey: ['clients'] })
    setShowCreateModal(false)
    createForm.reset()
  }

  // ── Edit client form ─────────────────────────────────────────────────────

  const editForm = useForm<ClientEditForm>()

  const openEdit = (c: Client) => {
    setEditingClient(c)
    editForm.reset({
      company_name: c.company_name,
      logo: c.logo ?? '',
      email: c.email,
      phone: c.phone ?? '',
      status: c.status,
    })
  }

  const onEditSubmit = (data: ClientEditForm) => {
    if (!editingClient) return
    updateClientMut.mutate({
      id: editingClient.id,
      data: {
        name: data.company_name,
        company_name: data.company_name,
        logo: data.logo || null,
        email: data.email,
        phone: data.phone || null,
        status: data.status,
        vat_id: editingClient.vat_id,
        address: editingClient.address,
        country: editingClient.country,
        website: editingClient.website,
        notes: editingClient.notes,
        tags: editingClient.tags,
      },
    })
  }

  // ── Add contact form ─────────────────────────────────────────────────────

  const addContactForm = useForm<ContactFormFields>({
    defaultValues: { name: '', position: '', email: '', phone: '', avatar: '' },
  })

  const openAddContact = (c: Client) => {
    setAddContactForClient(c)
    addContactForm.reset({ name: '', position: '', email: '', phone: '', avatar: '' })
  }

  const onAddContactSubmit = (data: ContactFormFields) => {
    if (!addContactForClient) return
    createContactMut.mutate({
      clientId: addContactForClient.id,
      data: {
        name: data.name,
        position: data.position || null,
        email: data.email,
        phone: data.phone || null,
        avatar: data.avatar || null,
        is_primary: false,
      },
    })
  }

  // ── Edit contact form ─────────────────────────────────────────────────────

  const editContactForm = useForm<ContactFormFields>({
    defaultValues: { name: '', position: '', email: '', phone: '', avatar: '' },
  })

  const openEditContact = (client: Client, contact: Contact) => {
    setEditingContact({ client, contact })
    editContactForm.reset({
      name: contact.name,
      position: contact.position ?? '',
      email: contact.email,
      phone: contact.phone ?? '',
      avatar: contact.avatar ?? '',
    })
  }

  const onEditContactSubmit = (data: ContactFormFields) => {
    if (!editingContact) return
    updateContactMut.mutate({
      clientId: editingContact.client.id,
      contactId: editingContact.contact.id,
      data: {
        name: data.name,
        position: data.position || null,
        email: data.email,
        phone: data.phone || null,
        avatar: data.avatar || null,
        is_primary: editingContact.contact.is_primary,
      },
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Delete error banner */}
      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your client relationships</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search size={15} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="bg-transparent text-sm outline-none flex-1"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input max-w-[160px]"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Card list */}
      <div className="space-y-3">
        {clients.length === 0 && (
          <div className="card text-center text-gray-400 py-12 text-sm">
            No clients yet. Add your first client!
          </div>
        )}

        {clients.map(c => {
          const isExpanded = expandedIds.has(c.id)
          const initials = c.company_name.charAt(0).toUpperCase()

          return (
            <div key={c.id} className="card p-0 overflow-hidden">
              {/* Client row — 3 columns */}
              <div className="grid grid-cols-[1fr_120px_180px] items-center px-5 py-4">

                {/* Col 1: logo + stacked info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    {c.logo
                      ? <img src={c.logo} alt="logo" className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{initials}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{c.company_name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    {c.phone && <p className="text-xs text-gray-400 truncate">{c.phone}</p>}
                    <p className="text-xs text-gray-300 mt-0.5">
                      {c.contacts.length} contact{c.contacts.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Col 2: status */}
                <div className="flex justify-center">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${STATUS_TEXT_COLOR[c.status] ?? 'text-gray-400'}`}
                    style={{ fontVariant: 'small-caps' }}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Col 3: actions */}
                <div className="flex items-center justify-end gap-1">
                  <Link to={`/clients/${c.id}`} className="btn-ghost p-1.5 text-brand-500" title="View details">
                    <ExternalLink size={15} />
                  </Link>
                  <button
                    onClick={() => openAddContact(c)}
                    className="btn-ghost p-1.5 text-gray-400 hover:text-brand-500"
                    title="Add contact"
                  >
                    <UserPlus size={15} />
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
                    title="Edit client"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteClientMut.mutate(c.id)}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                    title="Delete client"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
                    title={isExpanded ? 'Collapse' : 'Show contacts'}
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Expanded contacts */}
              {isExpanded && c.contacts.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                  {c.contacts.map(contact => (
                    <div
                      key={contact.id}
                      className="grid grid-cols-[1fr_120px_180px] items-center pl-12 pr-5 py-3"
                    >
                      {/* Cols 1+2 merged: avatar + contact info */}
                      <div className="col-span-2 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-brand-400 flex items-center justify-center flex-shrink-0">
                          {contact.avatar
                            ? <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                            : <span className="text-white font-bold text-xs">
                                {contact.name.charAt(0).toUpperCase()}
                              </span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-700 text-sm truncate">{contact.name}</p>
                          {contact.position && (
                            <p className="text-xs text-gray-400">{contact.position}</p>
                          )}
                          <p className="text-xs text-gray-400 truncate">{contact.email}</p>
                          {contact.phone && <p className="text-xs text-gray-300">{contact.phone}</p>}
                        </div>
                      </div>

                      {/* Col 3: contact actions (aligned with client actions) */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditContact(c, contact)}
                          className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
                          title="Edit contact"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteContactMut.mutate({ clientId: c.id, contactId: contact.id })}
                          className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                          title="Delete contact"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && c.contacts.length === 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 pl-12 pr-5 py-3 text-xs text-gray-400">
                  No contacts yet.{' '}
                  <button onClick={() => openAddContact(c)} className="text-brand-500 hover:underline">
                    Add one
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Create Client Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal title="New Client" onClose={() => { setShowCreateModal(false); createForm.reset() }} size="xl">
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-5">
            {/* Company section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Company</p>
              <div className="flex items-start gap-4">
                <div className="pt-5">
                  <ImageUpload
                    value={createForm.watch('logo')}
                    onChange={v => createForm.setValue('logo', v)}
                    initials={(createForm.watch('company_name') || 'C').charAt(0).toUpperCase()}
                    size="md"
                  />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Company Name *</label>
                    <input
                      {...createForm.register('company_name', { required: true })}
                      className="input"
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input
                      {...createForm.register('email', { required: true })}
                      type="email"
                      className="input"
                      placeholder="hello@acme.com"
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      {...createForm.register('phone')}
                      className="input"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select {...createForm.register('status')} className="input">
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Contacts section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</p>
              <div className="space-y-3">
                {contactFields.map((field, idx) => (
                  <div key={field.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="pt-5">
                        <ImageUpload
                          value={createForm.watch(`contacts.${idx}.avatar`)}
                          onChange={v => createForm.setValue(`contacts.${idx}.avatar`, v)}
                          initials={(createForm.watch(`contacts.${idx}.name`) || 'C').charAt(0).toUpperCase()}
                          size="sm"
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Name {idx === 0 ? '*' : ''}</label>
                          <input
                            {...createForm.register(`contacts.${idx}.name`, { required: idx === 0 })}
                            className="input"
                            placeholder="Jane Smith"
                          />
                        </div>
                        <div>
                          <label className="label">Position</label>
                          <input
                            {...createForm.register(`contacts.${idx}.position`)}
                            className="input"
                            placeholder="CEO"
                          />
                        </div>
                        <div>
                          <label className="label">Email {idx === 0 ? '*' : ''}</label>
                          <input
                            {...createForm.register(`contacts.${idx}.email`, { required: idx === 0 })}
                            type="email"
                            className="input"
                            placeholder="jane@acme.com"
                          />
                        </div>
                        <div>
                          <label className="label">Phone</label>
                          <input
                            {...createForm.register(`contacts.${idx}.phone`)}
                            className="input"
                            placeholder="+1 234 567 890"
                          />
                        </div>
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="mt-5 text-red-400 hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => append({ name: '', position: '', email: '', phone: '', avatar: '' })}
                className="mt-3 text-xs text-brand-500 hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add another contact
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowCreateModal(false); createForm.reset() }} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create Client
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Client Modal ───────────────────────────────────────────────── */}
      {editingClient && (
        <Modal title="Edit Client" onClose={() => setEditingClient(null)} size="lg">
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="pt-5">
                <ImageUpload
                  value={editForm.watch('logo')}
                  onChange={v => editForm.setValue('logo', v)}
                  initials={(editForm.watch('company_name') || editingClient.company_name).charAt(0).toUpperCase()}
                  size="md"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Company Name *</label>
                  <input
                    {...editForm.register('company_name', { required: true })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    {...editForm.register('email', { required: true })}
                    type="email"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input {...editForm.register('phone')} className="input" />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select {...editForm.register('status')} className="input">
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingClient(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateClientMut.isPending}>
                {updateClientMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Contact Modal ───────────────────────────────────────────────── */}
      {addContactForClient && (
        <Modal
          title={`Add Contact — ${addContactForClient.company_name}`}
          onClose={() => setAddContactForClient(null)}
        >
          <form onSubmit={addContactForm.handleSubmit(onAddContactSubmit)} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="pt-5">
                <ImageUpload
                  value={addContactForm.watch('avatar')}
                  onChange={v => addContactForm.setValue('avatar', v)}
                  initials={(addContactForm.watch('name') || 'C').charAt(0).toUpperCase()}
                  size="sm"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    {...addContactForm.register('name', { required: true })}
                    className="input"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="label">Position</label>
                  <input
                    {...addContactForm.register('position')}
                    className="input"
                    placeholder="CEO"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    {...addContactForm.register('email', { required: true })}
                    type="email"
                    className="input"
                    placeholder="jane@acme.com"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    {...addContactForm.register('phone')}
                    className="input"
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAddContactForClient(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={createContactMut.isPending}>
                {createContactMut.isPending ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Contact Modal ──────────────────────────────────────────────── */}
      {editingContact && (
        <Modal title="Edit Contact" onClose={() => setEditingContact(null)}>
          <form onSubmit={editContactForm.handleSubmit(onEditContactSubmit)} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="pt-5">
                <ImageUpload
                  value={editContactForm.watch('avatar')}
                  onChange={v => editContactForm.setValue('avatar', v)}
                  initials={(editContactForm.watch('name') || 'C').charAt(0).toUpperCase()}
                  size="sm"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    {...editContactForm.register('name', { required: true })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Position</label>
                  <input
                    {...editContactForm.register('position')}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    {...editContactForm.register('email', { required: true })}
                    type="email"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    {...editContactForm.register('phone')}
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingContact(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateContactMut.isPending}>
                {updateContactMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
