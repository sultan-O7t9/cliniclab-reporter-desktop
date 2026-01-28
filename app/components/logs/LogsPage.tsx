import React, { useEffect, useState, useCallback } from 'react'
import { Button } from '@/app/components/ui/button'

interface LogRow {
  id: number
  ts: string
  action: string
  level: string
  message?: string | null
  payload?: any
}

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [level, setLevel] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('app-theme')
      if (saved === 'light' || saved === 'dark') return saved
    }
    return 'dark' // default
  })

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    try {
      window.localStorage.setItem('app-theme', theme)
    } catch {
      // ignore persistence errors (private mode etc.)
    }
  }, [theme])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.conveyor.app.listLogs({ offset, limit, level: level || null, search: search || null })
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load logs', err)
    } finally {
      setLoading(false)
    }
  }, [offset, limit, level, search])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (id: number) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const totalPages = Math.ceil(total / limit)
  const page = Math.floor(offset / limit) + 1

  return (
    <div className="logs-page" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
        <h2 style={{ fontFamily: 'Cambria,serif', fontSize: 24, margin: 0, flex: '0 0 auto' }}>Logs</h2>
        <p style={{ fontSize: 14, }}>v 1.4.0</p>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </Button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select
          value={level || ''}
          onChange={(e) => {
            setOffset(0)
            setLevel(e.target.value || null)
          }}
          aria-label="Filter by level"
        >
          <option value="">All Levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
            setOffset(0)
          }}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          aria-label="search logs form"
        >
          <input
            placeholder="Search action/message"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 200 }}
            aria-label="Search logs"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('')
                setSearchInput('')
                setOffset(0)
              }}
            >
              Clear
            </Button>
          )}
        </form>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page >= totalPages}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>{loading ? 'Loading…' : `${total} logs`}</div>
      <div className="win-table-wrapper" style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table className="win-table" aria-label="application logs table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Time</th>
              <th style={{ width: 80 }}>Level</th>
              <th style={{ width: 180 }}>Action</th>
              <th>Message</th>
              <th style={{ width: 260 }}>Payload (preview)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 12 }}>
                  No logs.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isExp = !!expanded[r.id]
              const preview = r.payload
                ? typeof r.payload === 'object'
                  ? JSON.stringify(r.payload)
                  : String(r.payload)
                : ''
              return (
                <React.Fragment key={r.id}>
                  <tr
                    className={r.payload ? 'log-row has-payload' : 'log-row'}
                    style={{ cursor: r.payload ? 'pointer' : 'default' }}
                    onClick={() => r.payload && toggle(r.id)}
                    aria-expanded={isExp}
                  >
                    <td style={{ whiteSpace: 'nowrap' }}>{r.ts}</td>
                    <td>
                      <span
                        className="log-level-badge"
                        data-level={r.level}
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: 0.5,
                        }}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{r.action}</td>
                    <td style={{ fontSize: 12 }}>{r.message}</td>
                    <td
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        maxWidth: 260,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {preview}
                    </td>
                  </tr>
                  {isExp && r.payload && (
                    <tr className="log-payload-row">
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div
                          style={{
                            background: 'var(--payload-bg, #fafafa)',
                            borderTop: '1px solid rgba(0,0,0,0.06)',
                            padding: '8px 10px',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {typeof r.payload === 'object' ? JSON.stringify(r.payload, null, 2) : String(r.payload)}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 12 }}>
          Page {page} / {totalPages || 1}
        </span>
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setOffset(0)
          }}
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
