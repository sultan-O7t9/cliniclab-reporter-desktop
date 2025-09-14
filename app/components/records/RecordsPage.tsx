import React, { useEffect, useState } from 'react'
import type { ConveyorApi } from '@/lib/conveyor/api'

declare global {
  interface Window {
    conveyor: ConveyorApi
  }
}

interface RecordSummary {
  id: number
  patient_name: string | null
  patient_age?: number | null
  patient_sex?: string | null
  patient_father_or_husband?: string | null
  created_at?: string | null
}

const formatDate = (iso?: string | null) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return d.toLocaleString()
  } catch {
    /* ignore */
  }
  return iso || ''
}

export const RecordsPage: React.FC = () => {
  const [rows, setRows] = useState<RecordSummary[]>([])
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await window.conveyor.app.recentTestRecords(limit)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ fontFamily: 'Cambria,serif', fontSize: 24, margin: '0 0 16px' }}>Recent Records</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }} aria-label="record controls">
        <label style={{ fontSize: 12 }}>
          Limit:
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button onClick={load} disabled={loading} aria-label="Refresh records list">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <div
        style={{ overflow: 'auto', maxHeight: '70vh' }}
        aria-label="records table wrapper"
        className="win-table-wrapper"
      >
        <table className="win-table" aria-label="recent test records table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ minWidth: 160 }}>Patient</th>
              <th style={{ minWidth: 160 }}>Father/Husband</th>
              <th style={{ width: 100 }}>Age/Sex</th>
              <th style={{ minWidth: 160 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 12 }}>
                  No records.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.patient_name || ''}</td>
                <td>{r.patient_father_or_husband || ''}</td>
                <td>{(r.patient_age ?? '') + (r.patient_sex ? '/' + r.patient_sex : '')}</td>
                <td>{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecordsPage
