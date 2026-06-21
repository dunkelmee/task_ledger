import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Auth token injection ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('sl_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (r: any) => r,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err: any) => {
    const url: string = err?.config?.url ?? ''
    if (err?.response?.status === 401 && !url.startsWith('/auth/')) {
      localStorage.removeItem('sl_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }).then(r => r.data),
  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password', { old_password, new_password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}

// ── Clients ────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (params?: Record<string, string>) => api.get('/clients', { params }).then(r => r.data),
  get: (id: number) => api.get(`/clients/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/clients', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/clients/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/clients/${id}`),
  summary: (id: number) => api.get(`/clients/${id}/summary`).then(r => r.data),
  listContacts: (clientId: number) => api.get(`/clients/${clientId}/contacts`).then(r => r.data),
  createContact: (clientId: number, data: unknown) => api.post(`/clients/${clientId}/contacts`, data).then(r => r.data),
  updateContact: (clientId: number, contactId: number, data: unknown) => api.put(`/clients/${clientId}/contacts/${contactId}`, data).then(r => r.data),
  deleteContact: (clientId: number, contactId: number) => api.delete(`/clients/${clientId}/contacts/${contactId}`),
}

// ── Proposals ──────────────────────────────────────────────────────────────
export const proposalsApi = {
  list: (params?: Record<string, string>) => api.get('/proposals', { params }).then(r => r.data),
  get: (id: number) => api.get(`/proposals/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/proposals', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/proposals/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/proposals/${id}`),
  convertToProject: (id: number) => api.post(`/proposals/${id}/convert-to-project`).then(r => r.data),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markSent: (id: number) => api.patch(`/proposals/${id}/mark-sent`).then((r: any) => r.data),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markViewed: (id: number) => api.patch(`/proposals/${id}/mark-viewed`).then((r: any) => r.data),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markAccepted: (id: number) => api.patch(`/proposals/${id}/mark-accepted`).then((r: any) => r.data),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markRejected: (id: number) => api.patch(`/proposals/${id}/mark-rejected`).then((r: any) => r.data),
}

// ── Projects ───────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: Record<string, string>) => api.get('/projects', { params }).then(r => r.data),
  get: (id: number) => api.get(`/projects/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/projects', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/projects/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  kanban: (id: number) => api.get(`/projects/${id}/kanban`).then(r => r.data),
  tasks: (id: number) => api.get(`/projects/${id}/tasks`).then(r => r.data),
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: Record<string, string>) => api.get('/tasks', { params }).then(r => r.data),
  create: (data: unknown) => api.post('/tasks', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/tasks/${id}`, data).then(r => r.data),
  move: (id: number, status: string, position: number) =>
    api.patch(`/tasks/${id}/move`, null, { params: { status, position } }).then(r => r.data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
}

// ── Invoices ───────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: Record<string, string>) => api.get('/invoices', { params }).then(r => r.data),
  get: (id: number) => api.get(`/invoices/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/invoices', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/invoices/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/invoices/${id}`),
  send: (id: number) => api.patch(`/invoices/${id}/send`).then(r => r.data),
  markPaid: (id: number) => api.patch(`/invoices/${id}/mark-paid`).then(r => r.data),
}

// ── Payments ───────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (params?: Record<string, string>) => api.get('/payments', { params }).then(r => r.data),
  create: (data: unknown) => api.post('/payments', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/payments/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/payments/${id}`),
}

// ── Expenses ───────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (params?: Record<string, string>) => api.get('/expenses', { params }).then(r => r.data),
  create: (data: unknown) => api.post('/expenses', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/expenses/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
}

// ── Attachments ────────────────────────────────────────────────────────────
export const attachmentsApi = {
  list: (params: Record<string, string>) => api.get('/attachments', { params }).then(r => r.data),
  upload: (file: File, params: Record<string, string>) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/attachments', form, { params }).then(r => r.data)
  },
  download: (id: number) =>
    api.get(`/attachments/${id}/download`, { responseType: 'blob' }).then(r => r.data),
  delete: (id: number) => api.delete(`/attachments/${id}`),
}

// ── Time Entries ───────────────────────────────────────────────────────────
export const timeEntriesApi = {
  list: (params?: Record<string, string>) => api.get('/time-entries', { params }).then(r => r.data),
  create: (data: unknown) => api.post('/time-entries', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/time-entries/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/time-entries/${id}`),
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then(r => r.data),
  revenueChart: (period: string = 'year') =>
    api.get('/dashboard/revenue-chart', { params: { period } }).then(r => r.data),
  proposalChart: () => api.get('/dashboard/proposal-chart').then(r => r.data),
  projectProgress: () => api.get('/dashboard/project-progress').then(r => r.data),
}

// ── Settings ───────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings').then(r => r.data),
  update: (data: unknown) => api.put('/settings', data).then(r => r.data),
}

// ── Reminders ──────────────────────────────────────────────────────────────
export const remindersApi = {
  list: (params?: Record<string, string>) => api.get('/reminders', { params }).then(r => r.data),
  create: (data: unknown) => api.post('/reminders', data).then(r => r.data),
  update: (id: number, data: unknown) => api.put(`/reminders/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/reminders/${id}`),
}
