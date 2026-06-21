import { useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Clock, DollarSign, CalendarDays, CalendarClock, FileText, CheckCircle2, Check, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { DndContext, closestCorners, DragEndEvent, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { projectsApi, tasksApi, timeEntriesApi, invoicesApi, paymentsApi } from '../api'
import type { Project, Task, TimeEntry, Invoice, Payment, PaymentAllocation } from '../types'
import Badge, { statusBadgeVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-gray-200' },
  { id: 'todo', label: 'To-Do', color: 'bg-blue-200' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-brand-200' },
  { id: 'review', label: 'Review', color: 'bg-purple-200' },
  { id: 'waiting_client', label: 'Waiting for Client', color: 'bg-orange-200' },
  { id: 'delivered', label: 'Delivered', color: 'bg-green-200' },
]

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className="space-y-2 min-h-[80px] bg-gray-50/50 rounded-xl p-2">
      {children}
    </div>
  )
}

function TaskCard({
  task,
  onDelete,
  onEdit,
  onLogHours,
}: {
  task: Task
  onDelete: () => void
  onEdit: () => void
  onLogHours: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-gray-300 flex-shrink-0">
          <GripVertical size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge label={task.priority} variant={statusBadgeVariant(task.priority)} />
            {task.task_type !== 'design' && (
              <Badge label={task.task_type} variant="purple" />
            )}
            {task.due_date && (
              <span className="text-xs text-gray-400">
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.estimate_hours > 0 && (
              <span className="text-xs text-gray-400">{task.estimate_hours}h est.</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} title="Edit task" className="text-gray-400 hover:text-brand-500 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onLogHours} title="Log hours" className="text-gray-400 hover:text-green-500 transition-colors">
            <Clock size={13} />
          </button>
          <button onClick={onDelete} title="Delete task" className="text-red-400 hover:text-red-600 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface TaskFormValues {
  title: string
  description: string
  status: string
  priority: string
  task_type: string
  due_date: string
  estimate_hours: number
}

interface LogHoursFormValues {
  date: string
  mode: 'duration' | 'times'
  duration_value: number
  duration_unit: 'hours' | 'minutes'
  start_time: string
  end_time: string
  notes: string
  billable: boolean
}

const LOG_HOURS_DEFAULTS: LogHoursFormValues = {
  date: new Date().toISOString().split('T')[0],
  mode: 'duration',
  duration_value: 1,
  duration_unit: 'hours',
  start_time: '',
  end_time: '',
  notes: '',
  billable: true,
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const qc = useQueryClient()
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [logHoursTask, setLogHoursTask] = useState<Task | null>(null)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editEntryDraft, setEditEntryDraft] = useState({ date: '', hours: 0, notes: '' })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  const { data: kanbanData = {} } = useQuery<Record<string, Task[]>>({
    queryKey: ['kanban', projectId],
    queryFn: () => projectsApi.kanban(projectId),
  })

  const { data: projectTimeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries', 'project', projectId],
    queryFn: () => timeEntriesApi.list({ project_id: projectId.toString() }),
  })

  const { data: taskTimeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries', 'task', logHoursTask?.id],
    queryFn: () => timeEntriesApi.list({ task_id: String(logHoursTask!.id) }),
    enabled: !!logHoursTask,
  })

  const totalHoursLogged = projectTimeEntries.reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0) / 60

  const { data: projectInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices', 'project', projectId],
    queryFn: () => invoicesApi.list({ project_id: projectId.toString() }),
  })

  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.list(),
  })

  const projectInvoiceIds = new Set(projectInvoices.map((inv: Invoice) => inv.id))
  const pendingInvoices = projectInvoices.filter((inv: Invoice) => !['paid', 'cancelled'].includes(inv.status))
  const pendingTotal = pendingInvoices.reduce((s: number, inv: Invoice) => s + Number(inv.total), 0)
  const clearedTotal = allPayments
    .filter((p: Payment) => p.status === 'cleared')
    .flatMap((p: Payment) => p.allocations ?? [])
    .filter((a: PaymentAllocation) => projectInvoiceIds.has(a.invoice_id))
    .reduce((s: number, a: PaymentAllocation) => s + Number(a.amount), 0)

  // ── Add task form ──────────────────────────────────────────────────────────
  const { register, handleSubmit, reset } = useForm<TaskFormValues>({
    defaultValues: {
      title: '',
      description: '',
      status: 'backlog',
      priority: 'medium',
      task_type: 'design',
      due_date: '',
      estimate_hours: 0,
    },
  })

  // ── Edit task form ─────────────────────────────────────────────────────────
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
  } = useForm<TaskFormValues>()

  // ── Log hours form ─────────────────────────────────────────────────────────
  const {
    register: registerLog,
    handleSubmit: handleSubmitLog,
    watch: watchLog,
    reset: resetLog,
  } = useForm<LogHoursFormValues>({ defaultValues: LOG_HOURS_DEFAULTS })

  const logMode = watchLog('mode')

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createTask = useMutation({
    mutationFn: (data: unknown) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      qc.invalidateQueries({ queryKey: ['project-progress'] })
      reset()
      setShowTaskModal(false)
    },
  })

  const updateTask = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: unknown }) =>
      tasksApi.update(taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      setEditingTask(null)
    },
  })

  const deleteTask = useMutation({
    mutationFn: (taskId: number) => tasksApi.delete(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      qc.invalidateQueries({ queryKey: ['project-progress'] })
    },
  })

  const moveTask = useMutation({
    mutationFn: ({ taskId, status, position }: { taskId: number; status: string; position: number }) =>
      tasksApi.move(taskId, status, position),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      qc.invalidateQueries({ queryKey: ['project-progress'] })
    },
  })

  const createTimeEntry = useMutation({
    mutationFn: (data: unknown) => timeEntriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      resetLog({ ...LOG_HOURS_DEFAULTS, date: new Date().toISOString().split('T')[0] })
    },
  })

  const updateTimeEntry = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => timeEntriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      setEditingEntry(null)
    },
  })

  const deleteTimeEntry = useMutation({
    mutationFn: (id: number) => timeEntriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = Number(active.id)
    const overId = String(over.id)
    const colMatch = COLUMNS.find(c => c.id === overId)
    if (colMatch) {
      moveTask.mutate({ taskId, status: colMatch.id, position: 0 })
      return
    }
    const overTaskId = Number(overId)
    for (const [colId, tasks] of Object.entries(kanbanData as Record<string, Task[]>)) {
      if (tasks.some(t => t.id === overTaskId)) {
        moveTask.mutate({ taskId, status: colId, position: 0 })
        return
      }
    }
  }

  const onSubmitTask = (d: TaskFormValues) => {
    createTask.mutate({
      project_id: projectId,
      title: d.title,
      description: d.description || null,
      status: d.status || 'backlog',
      priority: d.priority || 'medium',
      task_type: d.task_type || 'design',
      due_date: d.due_date || null,
      estimate_hours: isNaN(d.estimate_hours) ? 0 : Number(d.estimate_hours),
      is_revision: false,
      revision_number: 0,
      position: 0,
    })
  }

  const onSubmitEditTask = (d: TaskFormValues) => {
    if (!editingTask) return
    updateTask.mutate({
      taskId: editingTask.id,
      data: {
        project_id: editingTask.project_id,
        title: d.title,
        description: d.description || null,
        status: d.status || editingTask.status,
        priority: d.priority || 'medium',
        task_type: d.task_type || 'design',
        due_date: d.due_date || null,
        estimate_hours: isNaN(d.estimate_hours) ? 0 : Number(d.estimate_hours),
        is_revision: editingTask.is_revision,
        revision_number: editingTask.revision_number,
        position: editingTask.position,
      },
    })
  }

  const onSubmitLogHours = (d: LogHoursFormValues) => {
    if (!logHoursTask) return
    let duration_minutes = 0
    if (d.mode === 'duration') {
      duration_minutes = d.duration_unit === 'hours'
        ? Math.round(d.duration_value * 60)
        : Math.round(d.duration_value)
    } else {
      if (d.start_time && d.end_time) {
        const start = new Date(`${d.date}T${d.start_time}`)
        const end = new Date(`${d.date}T${d.end_time}`)
        duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000)
      }
    }
    if (duration_minutes <= 0) return
    createTimeEntry.mutate({
      project_id: projectId,
      task_id: logHoursTask.id,
      date: d.date,
      duration_minutes,
      notes: d.notes || null,
      billable: d.billable,
    })
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    resetEdit({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      due_date: task.due_date || '',
      estimate_hours: task.estimate_hours,
    })
  }

  const openLogHoursModal = (task: Task) => {
    setLogHoursTask(task)
    resetLog({ ...LOG_HOURS_DEFAULTS, date: new Date().toISOString().split('T')[0] })
  }

  const openEntryEdit = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setEditEntryDraft({
      date: entry.date,
      hours: entry.duration_minutes / 60,
      notes: entry.notes ?? '',
    })
  }

  const saveEntryEdit = () => {
    if (!editingEntry || !logHoursTask) return
    const duration_minutes = Math.round(editEntryDraft.hours * 60)
    if (duration_minutes <= 0) return
    updateTimeEntry.mutate({
      id: editingEntry.id,
      data: {
        project_id: projectId,
        task_id: logHoursTask.id,
        date: editEntryDraft.date,
        duration_minutes,
        notes: editEntryDraft.notes || null,
        billable: editingEntry.billable,
      },
    })
  }

  if (isLoading) return <div className="text-gray-400 py-20 text-center">Loading...</div>
  if (!project) return <div className="text-gray-400 py-20 text-center">Project not found</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/projects" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-gray-400">
              {project.client?.name}{project.project_type ? ` · ${project.project_type}` : ''}
            </p>
            {project.contacts && project.contacts.length > 0 && (
              <div
                className="flex items-center"
                title={
                  project.contacts.length === 1
                    ? project.contacts[0].name
                    : `${project.contacts[0].name} and ${project.contacts.length - 1} other${project.contacts.length - 1 > 1 ? 's' : ''}`
                }
              >
                {project.contacts.slice(0, 5).map((c, i) => (
                  <div
                    key={c.id}
                    className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-brand-400 flex items-center justify-center border-2 border-white flex-shrink-0"
                    style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: 5 - i }}
                  >
                    {c.avatar
                      ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-[9px] leading-none">{c.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                ))}
                {project.contacts.length > 5 && (
                  <div
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white flex-shrink-0 text-[9px] font-semibold text-gray-500"
                    style={{ marginLeft: '-8px', zIndex: 0 }}
                  >
                    +{project.contacts.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Badge label={project.status} variant={statusBadgeVariant(project.status)} />
        <button onClick={() => setShowTaskModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Budget</p>
            <p className="text-base font-bold text-gray-800 truncate">{project.currency} {Number(project.budget).toLocaleString()}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={16} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Start Date</p>
            <p className="text-base font-bold text-gray-800 truncate">{project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <CalendarClock size={16} className="text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Deadline</p>
            <p className="text-base font-bold text-gray-800 truncate">{project.deadline ? new Date(project.deadline).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Hours Logged</p>
            <p className="text-base font-bold text-gray-800">{totalHoursLogged.toFixed(1)}h</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FileText size={16} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Pending Invoices</p>
            <p className="text-base font-bold text-amber-600 truncate">
              {pendingInvoices.length > 0 ? `${project.currency} ${pendingTotal.toLocaleString()}` : '—'}
            </p>
            {pendingInvoices.length > 0 && (
              <p className="text-xs text-gray-400">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Payments Cleared</p>
            <p className="text-base font-bold text-green-600 truncate">
              {clearedTotal > 0 ? `${project.currency} ${clearedTotal.toLocaleString()}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {project.description && (
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Description</p>
          <p className="text-sm text-gray-700">{project.description}</p>
        </div>
      )}

      {/* Kanban */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const tasks = kanbanData[col.id] ?? []
            return (
              <div key={col.id} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{tasks.length}</span>
                </div>
                <SortableContext items={tasks.map((t: Task) => t.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={col.id}>
                    {tasks.map((task: Task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={() => deleteTask.mutate(task.id)}
                        onEdit={() => openEditModal(task)}
                        onLogHours={() => openLogHoursModal(task)}
                      />
                    ))}
                  </DroppableColumn>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>

      {/* ── Add Task Modal ─────────────────────────────────────────────────── */}
      {showTaskModal && (
        <Modal title="Add Task" onClose={() => { setShowTaskModal(false); reset() }} size="md">
          <form onSubmit={handleSubmit(onSubmitTask)} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input {...register('title', { required: true })} className="input" placeholder="Task title" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea {...register('description')} className="input resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Column</label>
                <select {...register('status')} className="input">
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select {...register('priority')} className="input">
                  {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select {...register('task_type')} className="input">
                  {['design', 'revision', 'admin'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input {...register('due_date')} type="date" className="input" />
              </div>
              <div>
                <label className="label">Estimate (hours)</label>
                <input {...register('estimate_hours', { valueAsNumber: true })} type="number" min="0" step="0.5" className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowTaskModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={createTask.isPending}>
                {createTask.isPending ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Task Modal ────────────────────────────────────────────────── */}
      {editingTask && (
        <Modal title="Edit Task" onClose={() => setEditingTask(null)} size="md">
          <form onSubmit={handleSubmitEdit(onSubmitEditTask)} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input {...registerEdit('title', { required: true })} className="input" placeholder="Task title" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea {...registerEdit('description')} className="input resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Column</label>
                <select {...registerEdit('status')} className="input">
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select {...registerEdit('priority')} className="input">
                  {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select {...registerEdit('task_type')} className="input">
                  {['design', 'revision', 'admin'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input {...registerEdit('due_date')} type="date" className="input" />
              </div>
              <div>
                <label className="label">Estimate (hours)</label>
                <input {...registerEdit('estimate_hours', { valueAsNumber: true })} type="number" min="0" step="0.5" className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditingTask(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateTask.isPending}>
                {updateTask.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Log Hours Modal ────────────────────────────────────────────────── */}
      {logHoursTask && (
        <Modal
          title={`Log Hours — ${logHoursTask.title}`}
          onClose={() => { setLogHoursTask(null); resetLog(LOG_HOURS_DEFAULTS) }}
          size="md"
        >
          <div className="space-y-5">
            <form onSubmit={handleSubmitLog(onSubmitLogHours)} className="space-y-4">
              {/* Mode toggle */}
              <div>
                <label className="label">Log method</label>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {(['duration', 'times'] as const).map(m => (
                    <label
                      key={m}
                      className={`flex-1 text-center py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                        logMode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <input {...registerLog('mode')} type="radio" value={m} className="sr-only" />
                      {m === 'duration' ? 'Duration' : 'Start & End Time'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Date</label>
                <input {...registerLog('date', { required: true })} type="date" className="input" />
              </div>

              {logMode === 'duration' ? (
                <div>
                  <label className="label">Duration</label>
                  <div className="flex gap-2">
                    <input
                      {...registerLog('duration_value', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="any"
                      className="input"
                      placeholder="1"
                    />
                    <select {...registerLog('duration_unit')} className="input w-36 flex-shrink-0">
                      <option value="hours">Hours</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start Time</label>
                    <input {...registerLog('start_time', { required: logMode === 'times' })} type="time" className="input" />
                  </div>
                  <div>
                    <label className="label">End Time</label>
                    <input {...registerLog('end_time', { required: logMode === 'times' })} type="time" className="input" />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Notes</label>
                <textarea {...registerLog('notes')} className="input resize-none" rows={2} placeholder="What did you work on?" />
              </div>

              <div className="flex items-center gap-2">
                <input {...registerLog('billable')} type="checkbox" id="log-billable" className="rounded" />
                <label htmlFor="log-billable" className="text-sm text-gray-600 cursor-pointer">Billable</label>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={createTimeEntry.isPending}>
                  {createTimeEntry.isPending ? 'Logging...' : 'Log Hours'}
                </button>
              </div>
            </form>

            {/* Previously logged entries for this task */}
            {taskTimeEntries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Previously logged</p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {taskTimeEntries.map(entry => (
                    <div key={entry.id}>
                      {editingEntry?.id === entry.id ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={editEntryDraft.date}
                              onChange={e => setEditEntryDraft(d => ({ ...d, date: e.target.value }))}
                              className="input text-xs py-1 px-2 flex-1"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editEntryDraft.hours}
                                onChange={e => setEditEntryDraft(d => ({ ...d, hours: parseFloat(e.target.value) || 0 }))}
                                min="0"
                                step="0.25"
                                className="input text-xs py-1 px-2 w-20"
                              />
                              <span className="text-xs text-gray-400 flex-shrink-0">h</span>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={editEntryDraft.notes}
                            onChange={e => setEditEntryDraft(d => ({ ...d, notes: e.target.value }))}
                            placeholder="Notes"
                            className="input text-xs py-1 px-2 w-full"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingEntry(null)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={saveEntryEdit}
                              disabled={updateTimeEntry.isPending}
                              className="text-green-500 hover:text-green-700 transition-colors"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2 group">
                          <span className="text-gray-400 w-16 flex-shrink-0">
                            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="font-semibold text-gray-700 w-12 flex-shrink-0">{formatDuration(entry.duration_minutes)}</span>
                          {entry.notes && (
                            <span className="text-gray-400 truncate flex-1">{entry.notes}</span>
                          )}
                          {!entry.notes && <span className="flex-1" />}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => openEntryEdit(entry)}
                              className="text-gray-400 hover:text-brand-500 transition-colors"
                              title="Edit entry"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteTimeEntry.mutate(entry.id)}
                              disabled={deleteTimeEntry.isPending}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
