import React, { useState } from 'react'
import './styles/app.css'
import Sidebar from '@/app/components/layout/Sidebar'
import PatientPage from '@/app/components/patient/PatientPage'

export default function App() {
  const [active, setActive] = useState('patients')

  const renderPage = () => {
    switch (active) {
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
