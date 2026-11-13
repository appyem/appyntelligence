import type { ReactNode } from 'react'
import { Shield, LogOut, FileText, Link as LinkIcon, Activity, Upload, Terminal } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { signOut } from 'firebase/auth'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login')
  }

  const menuItems = [
    { path: '/dashboard', label: 'DASHBOARD', icon: Activity },
    { path: '/expedientes', label: 'EXPEDIENTES', icon: FileText },
    { path: '/enlaces', label: 'ENLACES INTELIGENTES', icon: LinkIcon },
    { path: '/evidencias', label: 'EVIDENCIAS', icon: Upload },
    { path: '/diagnostico', label: 'DIAGNOSTICO', icon: Terminal },
  ]

  return (
    <div className="min-h-screen bg-hacker-bg text-hacker-dim font-sans flex">
      <aside className="w-64 bg-hacker-panel border-r border-hacker-border flex flex-col">
        <div className="p-6 border-b border-hacker-border">
          <div className="flex items-center gap-2 text-hacker-green font-mono text-lg tracking-wider">
            <Shield className="w-6 h-6" />
            APPY
          </div>
          <div className="text-xs text-hacker-dim mt-1 font-mono">INTELLIGENCE v1.0</div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded font-mono text-sm transition-all ${
                  isActive 
                    ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30' 
                    : 'text-hacker-dim hover:text-hacker-cyan hover:bg-hacker-bg'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-hacker-border">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded font-mono text-sm text-hacker-red hover:bg-hacker-red/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            CERRAR SESION
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
