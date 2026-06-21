import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { dashboardApi, expensesApi } from '../api'
import { useSettings } from '../context/SettingsContext'

export default function Reports() {
  const { defaultCurrency } = useSettings()
  const fmt = (v: number) => `${defaultCurrency} ${Number(v).toLocaleString()}`
  const fmtTick = (v: number) => `${defaultCurrency} ${v}`

  const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats })
  const { data: revenueData = [] } = useQuery({ queryKey: ['revenue-chart'], queryFn: () => dashboardApi.revenueChart() })
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => expensesApi.list() })

  // Group expenses by category
  const expByCategory: Record<string, number> = {}
  for (const e of (expenses as any[])) {
    const cat = e.category || 'other'
    expByCategory[cat] = (expByCategory[cat] || 0) + Number(e.amount)
  }
  const categoryData = Object.entries(expByCategory).map(([name, value]) => ({ name, value }))

  const ytdCards = [
    { label: 'Revenue YTD', value: fmt(Number(stats?.revenue_ytd ?? 0)), color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Profit YTD', value: fmt(Number(stats?.profit_ytd ?? 0)), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Overdue Invoices', value: stats?.overdue_invoices ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Outstanding Invoices', value: stats?.outstanding_invoices ?? 0, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Financial overview and business metrics</p>
      </div>

      {/* YTD summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ytdCards.map(({ label, value, color, bg }) => (
          <div key={label} className={`card ${bg} border-0`}>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue last 12 months */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Revenue — Last 12 months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} barSize={24} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtTick} />
              <Tooltip formatter={(v: number) => [`${defaultCurrency} ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="revenue" fill="#e91e8c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by category */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Expenses by category</h2>
          {categoryData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No expenses recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} barSize={30} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtTick} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => [`${defaultCurrency} ${v.toLocaleString()}`, 'Amount']} contentStyle={{ borderRadius: 12, border: 'none' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* This month P&L */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">This Month — P&L Summary</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-xs text-gray-400 mb-1">Revenue</p>
            <p className="text-2xl font-bold text-green-600">{fmt(Number(stats?.revenue_this_month ?? 0))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Expenses</p>
            <p className="text-2xl font-bold text-red-500">{fmt(Number(stats?.expenses_this_month ?? 0))}</p>
          </div>
          <div className="border-l border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Profit</p>
            <p className={`text-2xl font-bold ${Number(stats?.profit_this_month ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {fmt(Number(stats?.profit_this_month ?? 0))}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {Number(stats?.revenue_this_month ?? 0) > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Expense ratio</span>
              <span>{Math.round(Number(stats?.expenses_this_month ?? 0) / Number(stats?.revenue_this_month ?? 1) * 100)}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                style={{ width: `${Math.max(0, 100 - Math.round(Number(stats?.expenses_this_month ?? 0) / Number(stats?.revenue_this_month ?? 1) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Profit margin</p>
          </div>
        )}
      </div>
    </div>
  )
}
