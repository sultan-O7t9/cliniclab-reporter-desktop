import React, { useEffect, useState } from 'react'
import './styles/app.css'
import Sidebar from '@/app/components/layout/Sidebar'
import PatientPage from '@/app/components/patient/PatientPage'
import RecordsPage from '@/app/components/records/RecordsPage'
import TestsPage from '@/app/components/tests/TestsPage'
import LogsPage from '@/app/components/logs/LogsPage'
import { AuthProvider, useAuth } from '@/app/components/auth/AuthContext'
import LoginScreen from '@/app/components/auth/LoginScreen'

const ConfirmModal: React.FC<{
  open: boolean
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}> = ({ open, title, description, onConfirm, onCancel, busy }) => {
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] max-w-[96vw] rounded-md bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {description ? <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">{description}</p> : null}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded-md border" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Applying…' : 'Apply update'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AppShell: React.FC = () => {
  const [active, setActive] = useState('patients')
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [lastAppliedInfo, setLastAppliedInfo] = useState<string | null>(null)

  // On mount, check if we need to prompt for the 2025 tests update
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (import.meta.env?.DEV) return
        const res = await window.conveyor.app.needsTestsUpdate2025()
        if (!mounted) return
        if (res?.needs) setShowUpdatePrompt(true)
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleApplyUpdate = async () => {
    setUpdateBusy(true)
    try {
      const res = await window.conveyor.app.applyTestsUpdate2025()
      setLastAppliedInfo(`Applied tests update (inserted ${res.inserted}, updated ${res.updated}).`)
    } catch {
      setLastAppliedInfo('Failed to apply tests update.')
    } finally {
      setUpdateBusy(false)
      setShowUpdatePrompt(false)
    }
  }

  const handleCancelUpdate = async () => {
    try {
      await window.conveyor.app.markTestsUpdatePrompted2025()
    } catch {
      // ignore
    } finally {
      setShowUpdatePrompt(false)
    }
  }

  const renderPage = () => {
    switch (active) {
      case 'records':
        return <RecordsPage />
      case 'tests':
        return <TestsPage />
      case 'logs':
        return <LogsPage />
      case 'patients':
      default:
        return <PatientPage />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="app-content" role="main">
        {lastAppliedInfo ? (
          <div className="mb-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            {lastAppliedInfo}
          </div>
        ) : null}
        {renderPage()}
      </main>
      {/* <ConfirmModal
        open={showUpdatePrompt}
        title="Apply updated default tests?"
        description="A one-time update is available to refresh default tests with improved specs and hierarchy. You can apply now or cancel to keep your current tests."
        onConfirm={handleApplyUpdate}
        onCancel={handleCancelUpdate}
        busy={updateBusy}
      /> */}
    </div>
  )
}

const RootGate: React.FC = () => {
  const { authed } = useAuth()
  if (!authed) return <LoginScreen />
  return <AppShell />
}

export default function App() {
  return (
    <AuthProvider>
      <RootGate />
    </AuthProvider>
  )
}
