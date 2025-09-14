import React, { useEffect, useState, useRef } from 'react'
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
  test_categories?: string | null
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
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      if (query.trim()) {
        const data = await window.conveyor.app.searchTestRecords(query.trim(), limit)
        setRows(data)
      } else {
        const data = await window.conveyor.app.recentTestRecords(limit)
        setRows(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      load()
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ fontFamily: 'Cambria,serif', fontSize: 24, margin: '0 0 16px' }}>Recent Records</h2>
      <div
        style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}
        aria-label="record controls"
      >
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
        <div style={{ position: 'relative' }} aria-label="patient name search box">
          <input
            type="text"
            placeholder="Search patient name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingRight: 22 }}
            aria-label="Search by patient name"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 2,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>
        <button onClick={load} disabled={loading} aria-label="Refresh records list">
          {loading ? 'Loading...' : query.trim() ? 'Search' : 'Refresh'}
        </button>
        {query.trim() && (
          <span style={{ fontSize: 11, opacity: 0.7 }} aria-label="search active indicator">
            Filtering by patient name
          </span>
        )}
      </div>
      <div
        style={{ overflow: 'auto', maxHeight: '70vh' }}
        aria-label="records table wrapper"
        className="win-table-wrapper"
      >
        <table className="win-table" aria-label="recent test records table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Sr No.</th>
              <th style={{ minWidth: 160 }}>Patient</th>
              <th style={{ minWidth: 160 }}>Father/Husband</th>
              <th style={{ width: 100 }}>Age/Sex</th>
              <th style={{ minWidth: 160 }}>Created</th>
              <th style={{ minWidth: 220 }}>Tests</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 12 }}>
                  No records.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.patient_name || ''}</td>
                <td>{r.patient_father_or_husband || ''}</td>
                <td>{(r.patient_age ?? '') + (r.patient_sex ? '/' + r.patient_sex : '')}</td>
                <td>{formatDate(r.created_at)}</td>
                <td style={{ fontSize: 11 }}>{r.test_categories || ''}</td>
                <td>
                  <button
                    type="button"
                    className="btn-win"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    aria-label={`Print record ${r.id}`}
                    onClick={async () => {
                      try {
                        const rec: any = await window.conveyor.app.getTestRecord(r.id)
                        if (!rec?.report) return
                        const result = await window.conveyor.app.printReport(rec.report)
                        if (!result?.printed) {
                          console.error('Print failed', result?.error)
                        }
                      } catch (err) {
                        console.error('Failed to print record', err)
                      }
                    }}
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecordsPage
