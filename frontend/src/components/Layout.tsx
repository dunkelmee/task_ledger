import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Search, Menu } from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#fdf2f8]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* No left margin on mobile; md:ml-60 on desktop */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen min-w-0">
        <header className="h-14 bg-white/80 backdrop-blur border-b border-gray-100 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-10">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
