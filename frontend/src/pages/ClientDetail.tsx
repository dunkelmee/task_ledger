import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { clientsApi } from '../api'
import type { Client, Contact } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ImageUpload from '../components/ui/ImageUpload'

interface ContactFormFields {
  name: string
  position: string
  email: string
  phone: string
  avatar: string
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const clientId = Number(id)
  const qc = useQueryClient()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  })

  const { data: summary } = useQuery({
    queryKey: ['client-summary', clientId],
    queryFn: () => clientsApi.summary(clientId),
  })

  // ── Add contact form ────────────────────────────────────────────────────

  const addForm = useForm<ContactFormFields>({
    defaultValues: { name: '', position: '', email: '', phone: '', avatar: '' },
  })

  const createContact = useMutation({
    mutationFn: (data: unknown) => clientsApi.createContact(clientId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      addForm.reset()
      setShowAddModal(false)
    },
  })

  const onAddSubmit = (data: ContactFormFields) => {
    createContact.mutate({
      name: data.name,
      position: data.position || null,
      email: data.email,
      phone: data.phone || null,
      avatar: data.avatar || null,
      is_primary: false,
    })
  }

  // ── Edit contact form ───────────────────────────────────────────────────

  const editForm = useForm<ContactFormFields>({
    defaultValues: { name: '', position: '', email: '', phone: '', avatar: '' },
  })

  const updateContact = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: unknown }) =>
      clientsApi.updateContact(clientId, contactId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setEditingContact(null)
    },
  })

  const openEdit = (contact: Contact) => {
    setEditingContact(contact)
    editForm.reset({
      name: contact.name,
      position: contact.position ?? '',
      email: contact.email,
      phone: contact.phone ?? '',
      avatar: contact.avatar ?? '',
    })
  }

  const onEditSubmit = (data: ContactFormFields) => {
    if (!editingContact) return
    updateContact.mutate({
      contactId: editingContact.id,
      data: {
        name: data.name,
        position: data.position || null,
        email: data.email,
        phone: data.phone || null,
        avatar: data.avatar || null,
        is_primary: editingContact.is_primary,
      },
    })
  }

  // ── Delete contact ──────────────────────────────────────────────────────

  const deleteContact = useMutation({
    mutationFn: (contactId: number) => clientsApi.deleteContact(clientId, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', clientId] }),
  })

  if (isLoading) return <div className="text-gray-400 py-20 text-center">Loading...</div>
  if (!client) return <div className="text-gray-400 py-20 text-center">Client not found</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
            {client.logo
              ? <img src={client.logo} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-white font-bold text-sm">{client.company_name.charAt(0).toUpperCase()}</span>
            }
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
        </div>
        <Badge label={client.status} variant={statusBadgeVariant(client.status)} className="ml-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Client info + contacts */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Client Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Email', client.email],
                ['Phone', client.phone],
                ['Website', client.website],
                ['VAT ID', client.vat_id],
                ['Country', client.country],
                ['Tags', client.tags],
              ].map(([label, value]) => value ? (
                <div key={label}>
                  <dt className="text-gray-400 text-xs mb-0.5">{label}</dt>
                  <dd className="text-gray-800 font-medium">{value}</dd>
                </div>
              ) : null)}
              {client.address && (
                <div className="col-span-2">
                  <dt className="text-gray-400 text-xs mb-0.5">Address</dt>
                  <dd className="text-gray-800 font-medium">{client.address}</dd>
                </div>
              )}
              {client.notes && (
                <div className="col-span-2">
                  <dt className="text-gray-400 text-xs mb-0.5">Notes</dt>
                  <dd className="text-gray-600">{client.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Contacts
                <span className="ml-2 text-xs font-normal text-gray-400">{client.contacts.length}</span>
              </h2>
              <button
                onClick={() => { setShowAddModal(true); addForm.reset() }}
                className="btn-ghost text-sm flex items-center gap-1"
              >
                <Plus size={14} /> Add contact
              </button>
            </div>

            {client.contacts.length === 0 ? (
              <p className="text-gray-400 text-sm">No contacts yet.</p>
            ) : (
              <div className="space-y-2">
                {client.contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-3">
                    {/* Avatar + stacked info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-brand-400 flex items-center justify-center flex-shrink-0">
                        {c.avatar
                          ? <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-xs">{c.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                        {c.position && <p className="text-xs text-gray-400">{c.position}</p>}
                        <p className="text-xs text-gray-400 truncate">{c.email}</p>
                        {c.phone && <p className="text-xs text-gray-300">{c.phone}</p>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(c)}
                        className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
                        title="Edit contact"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteContact.mutate(c.id)}
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
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          {[
            { label: 'Total Revenue', value: `$${Number(summary?.total_revenue ?? 0).toLocaleString()}`, color: 'text-green-600' },
            { label: 'Outstanding Balance', value: `$${Number(summary?.outstanding_balance ?? 0).toLocaleString()}`, color: 'text-orange-500' },
            { label: 'Projects', value: summary?.project_count ?? 0, color: 'text-blue-600' },
            { label: 'Invoices', value: summary?.invoice_count ?? 0, color: 'text-purple-600' },
            { label: 'Proposals', value: summary?.proposal_count ?? 0, color: 'text-brand-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Contact Modal ─────────────────────────────────────────────── */}
      {showAddModal && (
        <Modal title="Add Contact" onClose={() => setShowAddModal(false)}>
          <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="pt-5">
                <ImageUpload
                  value={addForm.watch('avatar')}
                  onChange={v => addForm.setValue('avatar', v)}
                  initials={(addForm.watch('name') || 'C').charAt(0).toUpperCase()}
                  size="sm"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    {...addForm.register('name', { required: true })}
                    className="input"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="label">Position</label>
                  <input
                    {...addForm.register('position')}
                    className="input"
                    placeholder="CEO"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    {...addForm.register('email', { required: true })}
                    type="email"
                    className="input"
                    placeholder="jane@acme.com"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    {...addForm.register('phone')}
                    className="input"
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={createContact.isPending}>
                {createContact.isPending ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Contact Modal ────────────────────────────────────────────── */}
      {editingContact && (
        <Modal title="Edit Contact" onClose={() => setEditingContact(null)}>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="pt-5">
                <ImageUpload
                  value={editForm.watch('avatar')}
                  onChange={v => editForm.setValue('avatar', v)}
                  initials={(editForm.watch('name') || 'C').charAt(0).toUpperCase()}
                  size="sm"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    {...editForm.register('name', { required: true })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Position</label>
                  <input
                    {...editForm.register('position')}
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
                  <input
                    {...editForm.register('phone')}
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingContact(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateContact.isPending}>
                {updateContact.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
