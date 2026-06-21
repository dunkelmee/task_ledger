import clsx from 'clsx'

type Variant = 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'gray' | 'pink'

const variants: Record<Variant, string> = {
  green: 'bg-green-100 text-green-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-600',
  pink: 'bg-brand-100 text-brand-700',
}

interface BadgeProps {
  label: string
  variant?: Variant
  className?: string
}

export default function Badge({ label, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide',
        '[font-variant:small-caps]',
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  )
}

export function statusBadgeVariant(status: string): Variant {
  const map: Record<string, Variant> = {
    // clients
    lead: 'blue',
    active: 'green',
    inactive: 'gray',
    archived: 'gray',
    // proposals
    draft: 'gray',
    sent: 'blue',
    viewed: 'purple',
    accepted: 'green',
    rejected: 'red',
    expired: 'orange',
    // invoices
    paid: 'green',
    partially_paid: 'orange',
    overdue: 'red',
    cancelled: 'gray',
    // projects
    paused: 'orange',
    completed: 'green',
    // tasks
    on_track: 'green',
    at_risk: 'orange',
    delayed: 'red',
    // payments
    cleared: 'green',
    pending: 'orange',
    // priorities
    low: 'gray',
    medium: 'blue',
    high: 'orange',
    urgent: 'red',
  }
  return map[status] ?? 'gray'
}
