interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg?: string
  sub?: string
}

export default function StatCard({ label, value, icon, iconBg = 'bg-brand-100', sub }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
