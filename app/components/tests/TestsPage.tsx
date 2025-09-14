import React, { useEffect, useState } from 'react'
import { Switch } from '@/app/components/ui/switch'
import type { ConveyorApi } from '@/lib/conveyor/api'

declare global {
  interface Window {
    conveyor: ConveyorApi
  }
}

interface TestRow {
  id: number
  name: string
  normal_value?: string | null
  result?: string | null
  required?: boolean | null
  timestamp?: string | null
}
interface GroupedTests {
  category: string
  tests: TestRow[]
}

export const TestsPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupedTests[]>([])
  const [loading, setLoading] = useState(false)
  const [addTestCat, setAddTestCat] = useState('')
  const [newTestName, setNewTestName] = useState('')
  const [newTestNormal, setNewTestNormal] = useState('')
  const [saving, setSaving] = useState(false)
  const [reseedStatus, setReseedStatus] = useState('')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await window.conveyor.app.allTestsGrouped()
      setGroups(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])
  const handleAddTest = async () => {
    if (!addTestCat.trim() || !newTestName.trim()) return
    setSaving(true)
    try {
      await window.conveyor.app.addTest(addTestCat.trim(), newTestName.trim(), newTestNormal.trim() || null)
      setNewTestName('')
      setNewTestNormal('')
      await load()
    } finally {
      setSaving(false)
    }
  }
  const handleUpdateNormal = async (id: number, normal: string) => {
    setSaving(true)
    try {
      await window.conveyor.app.updateTestNormal(id, normal)
    } finally {
      setSaving(false)
    }
  }
  const performReset = async () => {
    setSaving(true)
    try {
      const res = await window.conveyor.app.maintenanceReseedTests()
      setReseedStatus(`Reset & inserted ${res.inserted} (skipped ${res.skipped})`)
      await load()
    } finally {
      setSaving(false)
    }
  }
  const handleReseed = () => {
    setConfirmResetOpen(true)
  }
  const handleExport = async () => {
    try {
      const rows = await window.conveyor.app.exportTests()
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tests-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 0)
      setReseedStatus(`Exported ${rows.length} tests`)
    } catch (e) {
      console.error('Export failed', e)
      setReseedStatus('Export failed')
    }
  }
  const triggerImport = () => fileInputRef.current?.click()
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      if (!Array.isArray(json)) throw new Error('Invalid JSON: expected array')
      const sanitized = json
        .filter((r: any) => r && r.category && r.name)
        .map((r: any) => ({
          id: typeof r.id === 'number' ? r.id : undefined,
          // Preserve provided sort_order if numeric, else undefined to let backend assign
          sort_order: typeof r.sort_order === 'number' ? r.sort_order : undefined,
          category: String(r.category).trim(),
          name: String(r.name).trim(),
          normal_value: r.normal_value != null ? String(r.normal_value) : '',
          result: r.result != null ? String(r.result) : '',
          required: !!r.required,
        }))
      if (!sanitized.length) {
        setReseedStatus('No valid rows to import')
        return
      }
      const res = await window.conveyor.app.importTests(sanitized)
      setReseedStatus(`Imported ${res.inserted} (skipped ${res.skipped})`)
      await load()
    } catch (err) {
      console.error('Import failed', err)
      setReseedStatus('Import failed')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2
        style={{
          fontFamily: 'Cambria,serif',
          fontSize: 24,
          margin: '0 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Tests Maintenance <span style={{ fontSize: 14, fontWeight: 'normal' }}>{loading ? 'Loading…' : ''}</span>
      </h2>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}
        aria-label="tests maintenance controls"
        className="tests-form-block"
      >
        <div style={{ minWidth: 320 }} className="tests-form-block">
          <h4 style={{ margin: '0 0 6px' }}>Add Test</h4>
          <input
            placeholder="Category"
            value={addTestCat}
            onChange={(e) => setAddTestCat(e.target.value)}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <input
            placeholder="Test name"
            value={newTestName}
            onChange={(e) => setNewTestName(e.target.value)}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <input
            placeholder="Normal value (optional)"
            value={newTestNormal}
            onChange={(e) => setNewTestNormal(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          />
          <button
            disabled={saving || !addTestCat.trim() || !newTestName.trim()}
            onClick={handleAddTest}
            aria-label="Add new test to category"
            className="btn-win"
          >
            Add Test
          </button>
        </div>
        <div style={{ minWidth: 200 }} className="tests-form-block">
          <h4 style={{ margin: '0 0 6px' }}>Maintenance</h4>
          <button
            disabled={saving}
            onClick={handleReseed}
            className="btn-secondary btn-win"
            aria-label="Reset default tests"
          >
            Reset Defaults
          </button>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-win"
              disabled={saving}
              onClick={handleExport}
              aria-label="Export tests JSON"
            >
              Export
            </button>
            <button
              type="button"
              className="btn-win"
              disabled={saving}
              onClick={triggerImport}
              aria-label="Import tests JSON"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
          <div style={{ fontSize: 11, marginTop: 6 }}>{reseedStatus}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map((g) => (
          <div key={g.category} style={{ borderRadius: 4 }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Cambria,serif' }}>{g.category}</h3>
            <div className="win-table-wrapper">
              <table className="win-table" aria-label={`Tests in category ${g.category}`}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 10 }}>Test</th>
                    <th style={{ textAlign: 'center', width: 70 }}>Required</th>
                    <th style={{ textAlign: 'left', paddingLeft: 10 }}>Normal Value (Editable)</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tests
                    .filter((t) => t.name !== '_placeholder_')
                    .map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Switch
                            checked={!!t.required}
                            onCheckedChange={async (val) => {
                              // optimistic update
                              setGroups((prev) =>
                                prev.map((grp) =>
                                  grp.category === g.category
                                    ? {
                                        ...grp,
                                        tests: grp.tests.map((row) =>
                                          row.id === t.id ? { ...row, required: val } : row
                                        ),
                                      }
                                    : grp
                                )
                              )
                              try {
                                await window.conveyor.app.updateTestRequired(t.id, !!val)
                              } catch (err) {
                                console.error('Failed to update required', err)
                                // revert on failure
                                setGroups((prev) =>
                                  prev.map((grp) =>
                                    grp.category === g.category
                                      ? {
                                          ...grp,
                                          tests: grp.tests.map((row) =>
                                            row.id === t.id ? { ...row, required: t.required } : row
                                          ),
                                        }
                                      : grp
                                  )
                                )
                              }
                            }}
                            aria-label={`Toggle required for ${t.name}`}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <input
                            defaultValue={t.normal_value || ''}
                            aria-label={`Normal value for ${t.name}`}
                            className="win-inline-input"
                            onBlur={(e) => {
                              const val = e.target.value.trim()
                              if (val !== (t.normal_value || '')) {
                                handleUpdateNormal(t.id, val)
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  {g.tests.filter((t) => t.name !== '_placeholder_').length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: 8, fontStyle: 'italic' }}>
                        No tests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {confirmResetOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm Reset">
          <div className="modal-dialog">
            <h3>Reset Tests?</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
              This will delete ALL existing tests and restore the default set. Imported or custom tests will be lost
              unless you export them first. Continue?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-win btn-danger"
                onClick={() => {
                  setConfirmResetOpen(false)
                  performReset()
                }}
                disabled={saving}
                autoFocus
              >
                Yes, Reset
              </button>
              <button
                type="button"
                className="btn-win btn-secondary"
                onClick={() => setConfirmResetOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestsPage
