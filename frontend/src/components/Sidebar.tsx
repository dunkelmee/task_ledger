import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Briefcase, Wrench, FileText, BarChart2, Settings,
  ChevronDown, ChevronRight, Receipt, CreditCard,
  TrendingDown, LogOut, Users
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

const Logo = () => (
  <div className="flex items-center gap-3 px-4 py-5 mb-2">
    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
      <img src="/not_shane.svg" alt="Logo" className="w-full h-full object-contain" />
    </div>
    <span className="font-bold text-lg tracking-tight"><span className="text-white">Task</span><span className="text-brand-500">Ledger</span></span>
  </div>
)

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  exact?: boolean
}

const NavItem = ({ to, icon, label, exact }: NavItemProps) => (
  <NavLink
    to={to}
    end={exact}
    className={({ isActive }) =>
      isActive ? 'sidebar-item-active' : 'sidebar-item'
    }
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </NavLink>
)

const BusinessToolsMenu = () => {
  const location = useLocation()
  const isActive = ['/proposals', '/invoices', '/payments', '/expenses'].some(p =>
    location.pathname.startsWith(p)
  )
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium',
          isActive ? 'text-brand-400' : 'text-gray-400 hover:text-white hover:bg-sidebar-hover'
        )}
      >
        <Wrench size={18} />
        <span className="flex-1 text-left">Workflow</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="ml-6 mt-1 space-y-0.5">
          <NavItem to="/proposals" icon={<FileText size={16} />} label="Proposals" />
          <NavItem to="/invoices" icon={<Receipt size={16} />} label="Invoices" />
          <NavItem to="/payments" icon={<CreditCard size={16} />} label="Payments" />
          <NavItem to="/expenses" icon={<TrendingDown size={16} />} label="Expenses" />
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose: _onClose }: SidebarProps) {
  const { logout } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const businessName = settings?.business_name || 'TaskLedger'
  const position = settings?.position || ''
  const avatar = settings?.avatar

  const initials = businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={clsx(
        'w-60 min-h-screen flex flex-col fixed left-0 top-0 bottom-0 z-30',
        'border-r border-white/[0.08]',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(32,21,44,0.97) 0%, rgba(22,14,32,0.97) 60%, rgba(18,11,26,0.97) 100%)',
        boxShadow: '4px 0 40px rgba(0,0,0,0.45), inset 1px 0 0 rgba(255,255,255,0.06)',
      }}
    >
      <Logo />

      <nav className="flex-1 px-3 space-y-0.5">
        <NavItem to="/" icon={<Home size={18} />} label="Home" exact />
        <NavItem to="/clients" icon={<Users size={18} />} label="Clients" />
        <NavItem to="/projects" icon={<Briefcase size={18} />} label="Projects" />
        <BusinessToolsMenu />
        <NavItem to="/reports" icon={<BarChart2 size={18} />} label="Reports" />
        <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" />
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img
              src={avatar}
              alt="avatar"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">{initials || 'S'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{businessName}</p>
            {position && <p className="text-gray-400 text-xs truncate">{position}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
