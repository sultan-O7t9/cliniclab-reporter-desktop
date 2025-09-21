import React, { useState } from 'react'
import './styles/app.css'
import Sidebar from '@/app/components/layout/Sidebar'
import PatientPage from '@/app/components/patient/PatientPage'
import RecordsPage from '@/app/components/records/RecordsPage'
import TestsPage from '@/app/components/tests/TestsPage'
import LogsPage from '@/app/components/logs/LogsPage'
import { AuthProvider, useAuth } from '@/app/components/auth/AuthContext'
import LoginScreen from '@/app/components/auth/LoginScreen'

const AppShell: React.FC = () => {
  const [active, setActive] = useState('patients')

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
        {renderPage()}
      </main>
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
