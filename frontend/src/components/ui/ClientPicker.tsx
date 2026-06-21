import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { Client } from '../../types'

interface ClientPickerProps {
  clients: Client[]
  value: number
  onChange: (id: number) => void
  placeholder?: string
}

export default function ClientPicker({
  clients,
  value,
  onChange,
  placeholder = 'Select client',
}: ClientPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = clients.find(c => c.id === value)
  const filtered = search
    ? clients.filter(
        c =>
          c.company_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()),
      )
    : clients

  return (
    <div ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input flex items-center gap-2.5 w-full text-left min-h-[38px]"
      >
        {selected ? (
          <>
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              {selected.logo
                ? <img src={selected.logo} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-xs">{selected.company_name.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{selected.company_name}</p>
              <p className="text-xs text-gray-400 truncate">{selected.email}</p>
            </div>
          </>
        ) : (
          <span className="text-gray-400 flex-1">{placeholder}</span>
        )}
        <ChevronDown
          size={14}
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Inline dropdown */}
      {open && (
        <div className="mt-1 border border-gray-200 rounded-xl shadow-md bg-white overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No clients found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                    c.id === value ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    {c.logo
                      ? <img src={c.logo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-xs">{c.company_name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.company_name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    {c.phone && <p className="text-xs text-gray-300 truncate">{c.phone}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
