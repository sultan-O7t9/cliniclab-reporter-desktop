import React from 'react'
import { ClipboardPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarProps {
  active: string
  onSelect: (key: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ active, onSelect }) => {
  const items = [{ key: 'patients', label: 'Generate Report', icon: ClipboardPlus }]

  return (
    <nav className="era-sidebar" aria-label="Sidebar">
      <ul>
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className={cn('era-sidebar-btn', isActive && 'active')}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                <Icon className="icon" />
                <span className="label">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Sidebar
