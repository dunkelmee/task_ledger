import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Briefcase, Receipt, FileText, TrendingUp, Plus, X, Bell, Pencil } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { dashboardApi, remindersApi, clientsApi } from '../api'
import { useSettings } from '../context/SettingsContext'
import StatCard from '../components/ui/StatCard'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import type { Reminder, Client } from '../types'

const PINK = '#e91e8c'
const ORANGE = '#FF9F43'

const PRIORITY_VARIANT: Record<string, 'red' | 'orange' | 'green'> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
}

type Period = 'month' | 'quarter' | 'year'

interface ReminderForm {
  title: string
  notes?: string
  priority: 'low' | 'medium' | 'high'
  due_date: string
  client_id?: number
}

function ReminderModal({
  onClose,
  editing,
}: {
  onClose: () => void
  editing?: Reminder
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<ReminderForm>({
    defaultValues: editing
      ? {
          title: editing.title,
          notes: editing.notes ?? '',
          priority: editing.priority,
          due_date: editing.due_date,
          client_id: editing.client_id ?? undefined,
        }
      : { priority: 'medium' },
  })
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['clients'], queryFn: () => clientsApi.list() })

  const createMut = useMutation({
    mutationFn: (data: ReminderForm) => remindersApi.create({
      ...data,
      client_id: data.client_id ? Number(data.client_id) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders-upcoming'] }); onClose() },
  })

  const updateMut = useMutation({
    mutationFn: (data: ReminderForm) => remindersApi.update(editing!.id, {
      ...data,
      client_id: data.client_id ? Number(data.client_id) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders-upcoming'] }); onClose() },
  })

  const onSubmit = (data: ReminderForm) => {
    if (editing) updateMut.mutate(data)
    else createMut.mutate(data)
  }

  const isPending = createMut.isPending || updateMut.isPending

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">{editing ? 'Edit reminder' : 'Add reminder'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: true })} className="input" placeholder="Reminder title" />
            {errors.title && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
            <div>
              <label className="label">Due date *</label>
              <input {...register('due_date', { required: true })} type="date" className="input" />
              {errors.due_date && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
          </div>
          <div>
            <label className="label">Client (optional)</label>
            <select {...register('client_id')} className="input">
              <option value="">— None —</option>
              {(clients as Client[]).map((c: Client) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input resize-none" rows={2} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
            <button type="submit" className="flex-1 btn-primary py-2.5 text-sm" disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Add reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/** Returns 'today' | 'future' | 'past' based on reminder due_date vs today */
function reminderTiming(dueDate: string): 'today' | 'future' | 'past' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  if (due.getTime() === today.getTime()) return 'today'
  if (due > today) return 'future'
  return 'past'
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('year')
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const { ownerFirstName, defaultCurrency } = useSettings()
  const qc = useQueryClient()

  const fmt = (n: number) =>
    n >= 1000 ? `${defaultCurrency} ${(n / 1000).toFixed(1)}k` : `${defaultCurrency} ${n.toFixed(0)}`

  const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats })
  const { data: revenueData } = useQuery({
    queryKey: ['revenue-chart', period],
    queryFn: () => dashboardApi.revenueChart(period),
  })
  const { data: proposalData } = useQuery({ queryKey: ['proposal-chart'], queryFn: dashboardApi.proposalChart })
  const { data: projects } = useQuery({ queryKey: ['project-progress'], queryFn: dashboardApi.projectProgress })
  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ['reminders-upcoming'],
    queryFn: () => remindersApi.list({ upcoming: 'true' }),
  })

  const deleteReminder = useMutation({
    mutationFn: (id: number) => remindersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders-upcoming'] }),
  })

  const donutData = proposalData
    ? [
        { name: 'Proposals sent', value: Math.max(0, proposalData.sent - proposalData.accepted) },
        { name: 'Proposals accepted', value: Math.max(0, proposalData.accepted) },
      ]
    : []

  const periodLabel: Record<Period, string> = { month: 'Month', quarter: 'Quarter', year: 'Year' }

  const openEditReminder = (r: Reminder) => { setEditingReminder(r); setShowReminderModal(true) }
  const closeModal = () => { setShowReminderModal(false); setEditingReminder(null) }

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {showReminderModal && (
        <ReminderModal
          onClose={closeModal}
          editing={editingReminder ?? undefined}
        />
      )}

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{ownerFirstName ? `, ${ownerFirstName}` : ''}! 😊
          </h1>
        </div>

        {/* Stats — 3 cards (Pending Quotes removed) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Active Projects"
            value={stats?.active_projects ?? 0}
            icon={<Briefcase size={22} className="text-orange-500" />}
            iconBg="bg-orange-100"
          />
          <StatCard
            label="Pending Invoices"
            value={`${defaultCurrency} ${Number(stats?.invoices_pending_amount ?? 0).toLocaleString()}`}
            icon={<Receipt size={22} className="text-blue-500" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            label="Sent Proposals"
            value={stats?.proposals_sent ?? 0}
            icon={<FileText size={22} className="text-green-500" />}
            iconBg="bg-green-100"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <div className="card lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Project Income</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {defaultCurrency} {Number(stats?.revenue_this_month ?? 0).toLocaleString()}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                    <TrendingUp size={11} />
                    This month
                  </span>
                </div>
              </div>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                {(['month', 'quarter', 'year'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      period === p ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {periodLabel[p]}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueData ?? []} barSize={22} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip
                  formatter={(v: number) => [`${defaultCurrency} ${v.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" fill={PINK} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Proposal donut */}
          <div className="card">
            <p className="text-sm font-medium text-gray-500 mb-3">Proposal Acceptance Rate</p>
            <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
              <PieChart width={180} height={180}>
                <Pie
                  data={donutData.length ? donutData : [{ name: 'No data', value: 1 }]}
                  cx={90} cy={90} innerRadius={55} outerRadius={80}
                  dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}
                >
                  {donutData.length ? (
                    donutData.map((_, i) => <Cell key={i} fill={i === 0 ? PINK : ORANGE} />)
                  ) : (
                    <Cell fill="#e5e7eb" />
                  )}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 leading-none">{proposalData?.total ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Total</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block flex-shrink-0" />
                Sent ({Math.max(0, (proposalData?.sent ?? 0) - (proposalData?.accepted ?? 0))})
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block flex-shrink-0" />
                Accepted ({proposalData?.accepted ?? 0})
              </div>
            </div>
          </div>
        </div>

        {/* Project progress */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Project Progress Overview</h3>
          {!projects || projects.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">No active projects</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Due Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(projects as any[]).map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                              style={{ width: `${p.progress_pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{p.progress_pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{p.client_name}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        {p.deadline ? new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          label={p.status === 'on_track' ? 'On track' : p.status === 'at_risk' ? 'At risk' : 'Delayed'}
                          variant={statusBadgeVariant(p.status)}
                        />
                      </td>
                      <td className="py-3">
                        <Link to={`/projects/${p.id}`} className="text-brand-500 hover:text-brand-700 font-medium text-xs">
                          View &rsaquo;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────── */}
      <aside className="w-full lg:w-72 lg:flex-shrink-0 space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Reminders</h3>
            <button
              onClick={() => { setEditingReminder(null); setShowReminderModal(true) }}
              className="flex items-center gap-1 text-brand-500 text-xs font-medium hover:text-brand-700"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {(reminders as Reminder[]).length === 0 ? (
            <div className="text-center py-6">
              <Bell size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No upcoming reminders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(reminders as Reminder[]).slice(0, 5).map((r: Reminder) => {
                const timing = reminderTiming(r.due_date)
                return (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        label={r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
                        variant={PRIORITY_VARIANT[r.priority] ?? 'orange'}
                      />
                      <div className="flex items-center gap-1.5">
                        {/* Bell icon: red = today, orange = future */}
                        {timing === 'today' && (
                          <Bell size={13} className="text-red-500 fill-red-500" />
                        )}
                        {timing === 'future' && (
                          <Bell size={13} className="text-orange-400 fill-orange-400" />
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={() => openEditReminder(r)}
                          className="text-gray-300 hover:text-blue-400 transition-colors"
                          title="Edit reminder"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => deleteReminder.mutate(r.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{r.title}</p>
                    {r.client && <p className="text-xs text-gray-400 mt-0.5">{r.client.name}</p>}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => { setEditingReminder(null); setShowReminderModal(true) }}
            className="mt-4 w-full btn-primary text-sm py-2.5 rounded-xl"
          >
            Add reminder
          </button>
        </div>

        {/* Quick stats */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">This Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Revenue</span>
              <span className="text-sm font-semibold text-gray-800">
                {defaultCurrency} {Number(stats?.revenue_this_month ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Expenses</span>
              <span className="text-sm font-semibold text-red-500">
                -{defaultCurrency} {Number(stats?.expenses_this_month ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Profit</span>
              <span className="text-sm font-bold text-green-600">
                {defaultCurrency} {Number(stats?.profit_this_month ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {(stats?.overdue_invoices ?? 0) > 0 && (
          <div className="card border border-red-100 bg-red-50">
            <p className="text-sm font-semibold text-red-700">
              {stats!.overdue_invoices} Overdue Invoice{stats!.overdue_invoices > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500 mt-1">Follow up with clients to get paid</p>
            <Link to="/invoices?status=overdue" className="text-red-600 text-xs font-medium hover:underline mt-2 block">
              View overdue &rsaquo;
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
