import React, { useCallback, useEffect, useState } from 'react'
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
  normal_spec?: string | null
  result?: string | null
  required?: boolean | null
  timestamp?: string | null
  parent_id?: number | null
  // server may provide sort_order; used for stable ordering
  sort_order?: number | null
  children?: TestRow[]
  // computed locally for fast render
  normal_display?: string
}
interface GroupedTests {
  category: string
  tests: TestRow[]
}

// Helpers for display and transforms (module-level, pure)
type NormalType = 'text' | 'options' | 'range'
type OptItem = { label: string; color?: string }
// Default color palette for quick picking (hex values equivalent to requested rgb colors)
const COLOR_PALETTE = ['#FF0000', '#00FF00']
const sortRows = (a: TestRow, b: TestRow) => {
  const ao = typeof a.sort_order === 'number' ? a.sort_order : 999999
  const bo = typeof b.sort_order === 'number' ? b.sort_order : 999999
  if (ao !== bo) return ao - bo
  if (typeof a.id === 'number' && typeof b.id === 'number' && a.id !== b.id) return a.id - b.id
  return String(a.name).localeCompare(String(b.name))
}
const transformGroups = (data: GroupedTests[]): GroupedTests[] => {
  return data.map((grp) => {
    const tests = (grp.tests || [])
      .filter((t) => t.name !== '_placeholder_')
      .map((t) => {
        const children = (t.children || [])
          .filter((c) => c.name !== '_placeholder_')
          .sort(sortRows)
          .map((c) => ({ ...c, normal_display: (c.normal_value || '').toString().trim() }))
        return { ...t, children, normal_display: (t.normal_value || '').toString().trim() }
      })
      .sort(sortRows)
    return { ...grp, tests }
  })
}

export const TestsPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupedTests[]>([])
  const [loading, setLoading] = useState(false)
  const [addTestCat, setAddTestCat] = useState('')
  const [newTestName, setNewTestName] = useState('')
  const [newTestNormal, setNewTestNormal] = useState('')
  // Optional representation override saved as normal_value
  const [newNormalDisplay, setNewNormalDisplay] = useState('')
  // New: normal type and builders for Add Test
  const [newNormalType, setNewNormalType] = useState<NormalType>('text')
  const [optionInput, setOptionInput] = useState('')
  const [optionsList, setOptionsList] = useState<OptItem[]>([])
  const [rangeMin, setRangeMin] = useState<string>('')
  const [rangeMax, setRangeMax] = useState<string>('')
  // Named ranges (e.g., M/F)
  const [useNamedRanges, setUseNamedRanges] = useState<boolean>(false)
  const [maleMin, setMaleMin] = useState<string>('')
  const [maleMax, setMaleMax] = useState<string>('')
  const [femaleMin, setFemaleMin] = useState<string>('')
  const [femaleMax, setFemaleMax] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [reseedStatus, setReseedStatus] = useState('')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  // Edit modal state for existing rows
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<{ id: number; category: string; name: string } | null>(null)
  const [editType, setEditType] = useState<NormalType>('text')
  const [editText, setEditText] = useState('')
  const [editOptions, setEditOptions] = useState<OptItem[]>([])
  const [editOptionInput, setEditOptionInput] = useState('')
  const [editRangeMin, setEditRangeMin] = useState('')
  const [editRangeMax, setEditRangeMax] = useState('')
  const [editUseNamed, setEditUseNamed] = useState(false)
  const [editMaleMin, setEditMaleMin] = useState('')
  const [editMaleMax, setEditMaleMax] = useState('')
  const [editFemaleMin, setEditFemaleMin] = useState('')
  const [editFemaleMax, setEditFemaleMax] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.conveyor.app.allTestsGrouped()
      setGroups(transformGroups(data))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const parseSpec = (raw?: string | null) => {
    const s = (raw || '').trim()
    if (!s) return null
    try {
      const o = JSON.parse(s)
      return o && typeof o === 'object' ? o : null
    } catch {
      return null
    }
  }

  const openEdit = (row: TestRow, category: string) => {
    setEditRow({ id: row.id, category, name: row.name })
    const spec = parseSpec(row.normal_spec)
    const rep = (row.normal_value || '').trim()
    if (spec && spec.type === 'options' && Array.isArray(spec.options)) {
      setEditType('options')
      const list = spec.options.map((x: any) => (typeof x === 'string' ? { label: x } : x))
      setEditOptions(list)
      setEditOptionInput('')
      setEditText('')
      setEditRangeMin('')
      setEditRangeMax('')
      setEditUseNamed(false)
      setEditMaleMin('')
      setEditMaleMax('')
      setEditFemaleMin('')
      setEditFemaleMax('')
    } else if (spec && spec.type === 'sexed-range') {
      setEditType('range')
      setEditUseNamed(true)
      setEditMaleMin(spec.male?.min ?? '')
      setEditMaleMax(spec.male?.max ?? '')
      setEditFemaleMin(spec.female?.min ?? '')
      setEditFemaleMax(spec.female?.max ?? '')
      setEditOptions([])
      setEditOptionInput('')
      setEditText('')
    } else if (spec && spec.type === 'range') {
      setEditType('range')
      setEditUseNamed(false)
      setEditRangeMin(spec.range?.min ?? '')
      setEditRangeMax(spec.range?.max ?? '')
      setEditOptions([])
      setEditOptionInput('')
      setEditText('')
    } else {
      setEditType('text')
      setEditText(rep)
      setEditOptions([])
      setEditOptionInput('')
      setEditRangeMin('')
      setEditRangeMax('')
      setEditUseNamed(false)
      setEditMaleMin('')
      setEditMaleMax('')
      setEditFemaleMin('')
      setEditFemaleMax('')
    }
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!editRow) return
    const kind = editType
    let spec: string | null = null
    let value = ''
    // In Edit: only change representation if Text type is selected; for Options/Range, keep the existing
    // representation as-is unless user provides Text. We still update normal_spec for all types.
    if (kind === 'text') {
      value = editText.trim()
      spec = null
    } else if (kind === 'options') {
      const list = editOptions.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), color: o.color }))
      spec = list.length ? JSON.stringify({ type: 'options', options: list }) : null
      value = '' // do not auto-fill representation from options
    } else {
      if (editUseNamed) {
        const male = editMaleMin || editMaleMax ? { min: num(editMaleMin), max: num(editMaleMax) } : undefined
        const female = editFemaleMin || editFemaleMax ? { min: num(editFemaleMin), max: num(editFemaleMax) } : undefined
        spec = male || female ? JSON.stringify({ type: 'sexed-range', male, female }) : null
      } else {
        const range = editRangeMin || editRangeMax ? { min: num(editRangeMin), max: num(editRangeMax) } : undefined
        spec = range ? JSON.stringify({ type: 'range', range }) : null
      }
      value = '' // do not auto-fill representation from ranges
    }
    try {
      await window.conveyor.app.updateTestNormalSpec(editRow.id, value, spec || null)
      // optimistic local update
      setGroups((prev) =>
        prev.map((grp) =>
          grp.category === editRow.category
            ? {
                ...grp,
                tests: grp.tests.map((row) => {
                  if (row.id === editRow.id)
                    return { ...row, normal_value: value, normal_spec: spec, normal_display: value }
                  if (row.children && row.children.length) {
                    const updated = row.children.map((c) =>
                      c.id === editRow.id ? { ...c, normal_value: value, normal_spec: spec, normal_display: value } : c
                    )
                    return { ...row, children: updated }
                  }
                  return row
                }),
              }
            : grp
        )
      )
    } catch (e) {
      console.error('Failed to update test spec', e)
    } finally {
      setEditOpen(false)
      setEditRow(null)
    }
  }
  const num = (s?: string) => {
    if (typeof s === 'number') return s
    const v = (s || '').trim()
    return v ? Number(v) : undefined
  }
  const buildNormalSpecAndValue = (kind: NormalType, params: any): { spec: string | null; value: string } => {
    // Build a human-readable normal_value for UI, and a JSON spec for persistence
    if (kind === 'text') {
      const value = (params.text || '').trim()
      return { spec: null, value }
    }
    if (kind === 'options') {
      const list: OptItem[] = (params.options || [])
        .map((o: any) => ({ label: String(o.label || '').trim(), color: o.color ? String(o.color) : undefined }))
        .filter((o: OptItem) => !!o.label)
      const spec = list.length ? JSON.stringify({ type: 'options', options: list }) : null
      const value = list.map((o) => o.label).join(' | ')
      return { spec, value }
    }
    // range
    if (params.named) {
      const mmin = params.maleMin?.trim()
      const mmax = params.maleMax?.trim()
      const fmin = params.femaleMin?.trim()
      const fmax = params.femaleMax?.trim()
      const male =
        mmin || mmax ? { min: mmin ? Number(mmin) : undefined, max: mmax ? Number(mmax) : undefined } : undefined
      const female =
        fmin || fmax ? { min: fmin ? Number(fmin) : undefined, max: fmax ? Number(fmax) : undefined } : undefined
      const spec = male || female ? JSON.stringify({ type: 'sexed-range', male, female }) : null
      const seg = (r?: { min?: number; max?: number }) =>
        !r
          ? ''
          : typeof r.min === 'number' && typeof r.max === 'number'
            ? `${r.min} - ${r.max}`
            : typeof r.min === 'number'
              ? `>= ${r.min}`
              : typeof r.max === 'number'
                ? `<= ${r.max}`
                : ''
      const parts: string[] = []
      if (male) parts.push(`M: ${seg(male)}`)
      if (female) parts.push(`F: ${seg(female)}`)
      return { spec, value: parts.join(', ') }
    }
    const rmin = params.min?.trim()
    const rmax = params.max?.trim()
    const range =
      rmin || rmax ? { min: rmin ? Number(rmin) : undefined, max: rmax ? Number(rmax) : undefined } : undefined
    const spec = range ? JSON.stringify({ type: 'range', range }) : null
    const value = range
      ? typeof range.min === 'number' && typeof range.max === 'number'
        ? `${range.min} - ${range.max}`
        : typeof range.min === 'number'
          ? `>= ${range.min}`
          : typeof range.max === 'number'
            ? `<= ${range.max}`
            : ''
      : ''
    return { spec, value }
  }

  const handleAddTest = async () => {
    if (!addTestCat.trim() || !newTestName.trim()) return
    setSaving(true)
    try {
      const kind = newNormalType
      const { spec } = buildNormalSpecAndValue(kind, {
        text: newTestNormal,
        options: optionsList,
        min: rangeMin,
        max: rangeMax,
        named: useNamedRanges,
        maleMin,
        maleMax,
        femaleMin,
        femaleMax,
      })
      const rep = (newNormalDisplay || '').trim()
      await window.conveyor.app.addTest(addTestCat.trim(), newTestName.trim(), rep, spec)
      setNewTestName('')
      setNewTestNormal('')
      setNewNormalDisplay('')
      setOptionsList([])
      setOptionInput('')
      setRangeMin('')
      setRangeMax('')
      setUseNamedRanges(false)
      setMaleMin('')
      setMaleMax('')
      setFemaleMin('')
      setFemaleMax('')
      setNewNormalType('text')
      await load()
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

  // normalDisplay now computed in transformGroups for each row as normal_display
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
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('JSON_PARSE_ERROR')
      }
      if (!Array.isArray(json)) throw new Error('JSON_NOT_ARRAY')

      // Validate each row before overriding
      for (const r of json) {
        if (!r || typeof r.category !== 'string' || typeof r.name !== 'string') {
          throw new Error('JSON_SCHEMA_INVALID')
        }
        if (r.normal_spec != null && typeof r.normal_spec !== 'string' && typeof r.normal_spec !== 'object') {
          throw new Error('JSON_SCHEMA_INVALID')
        }
        // If normal_spec is a string, it must be valid JSON
        if (typeof r.normal_spec === 'string') {
          try {
            JSON.parse(r.normal_spec)
          } catch {
            throw new Error('JSON_SCHEMA_INVALID')
          }
        }
      }

      const sanitized = json
        .filter((r: any) => r && r.category && r.name)
        .map((r: any) => {
          // Normalize normal_spec: preserve text; if not available, set to text
          let normSpec: string | undefined = undefined
          if (typeof r.normal_spec === 'string') {
            // Already validated JSON string; keep as-is to preserve text/options/range
            normSpec = r.normal_spec
          } else if (r.normal_spec && typeof r.normal_spec === 'object') {
            try {
              normSpec = JSON.stringify(r.normal_spec)
            } catch {
              throw new Error('JSON_SCHEMA_INVALID')
            }
          } else {
            // Missing -> treat as text
            normSpec = JSON.stringify({ type: 'text' })
          }
          return {
            id: typeof r.id === 'number' ? r.id : undefined,
            // Preserve provided sort_order if numeric, else undefined to let backend assign
            sort_order: typeof r.sort_order === 'number' ? r.sort_order : undefined,
            category: String(r.category).trim(),
            name: String(r.name).trim(),
            normal_value: r.normal_value != null ? String(r.normal_value) : '',
            normal_spec: normSpec,
            result: r.result != null ? String(r.result) : '',
            required: !!r.required,
            parent_id: typeof r.parent_id === 'number' ? r.parent_id : undefined,
          }
        })
      if (!sanitized.length) throw new Error('JSON_EMPTY')
      const res = await window.conveyor.app.importTests(sanitized)
      const updated = typeof (res as any).updated === 'number' ? (res as any).updated : 0
      const skipped = typeof (res as any).skipped === 'number' ? (res as any).skipped : 0
      setReseedStatus(`Imported ${res.inserted}, Updated ${updated}, Skipped ${skipped}`)
      await load()
    } catch (err) {
      console.error('Import failed', err)
      setReseedStatus('JSON import failed')
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
          {/* Normal type selector */}
          <div
            style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '6px 0' }}
            role="radiogroup"
            aria-label="Normal type"
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="normal-type"
                value="text"
                checked={newNormalType === 'text'}
                onChange={() => setNewNormalType('text')}
              />
              <span>Text</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="normal-type"
                value="options"
                checked={newNormalType === 'options'}
                onChange={() => setNewNormalType('options')}
              />
              <span>Options</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="normal-type"
                value="range"
                checked={newNormalType === 'range'}
                onChange={() => setNewNormalType('range')}
              />
              <span>Range</span>
            </label>
          </div>
          {/* Dynamic normal inputs */}
          {newNormalType === 'text' && (
            <input
              placeholder="Normal value (e.g., 12 to 15)"
              value={newTestNormal}
              onChange={(e) => setNewTestNormal(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            />
          )}
          {newNormalType === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder="Add an option"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-win"
                  onClick={() => {
                    const v = optionInput.trim()
                    if (!v) return
                    setOptionsList((list) => (list.some((x) => x.label === v) ? list : [...list, { label: v }]))
                    setOptionInput('')
                  }}
                >
                  + Add
                </button>
              </div>
              {optionsList.length > 0 && (
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 6, alignItems: 'center' }}
                >
                  {optionsList.map((opt, idx) => (
                    <React.Fragment key={opt.label}>
                      <span className="badge-win" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {opt.label}
                      </span>
                      <input
                        type="color"
                        value={opt.color || '#000000'}
                        onChange={(e) => {
                          const color = e.target.value
                          setOptionsList((list) => list.map((o, i) => (i === idx ? { ...o, color } : o)))
                        }}
                        title="Pick color for this option"
                      />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Quick colors">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setOptionsList((list) => list.map((o, i) => (i === idx ? { ...o, color: c } : o)))
                            }
                            title={c}
                            aria-label={`Set color ${c} for ${opt.label}`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: '1px solid #ccc',
                              backgroundColor: c,
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-win btn-secondary"
                        style={{ padding: '0 6px' }}
                        onClick={() => setOptionsList((list) => list.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Normal value shown as: {optionsList.map((o) => o.label).join(' | ') || '—'}
              </div>
            </div>
          )}
          {newNormalType === 'range' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={useNamedRanges}
                    onChange={(e) => setUseNamedRanges(e.target.checked)}
                  />
                  <span>Named ranges (e.g., M/F)</span>
                </label>
              </div>
              {!useNamedRanges ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder="Min"
                    type="number"
                    step="any"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    style={{ width: 120 }}
                  />
                  <input
                    placeholder="Max"
                    type="number"
                    step="any"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 6, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>M</div>
                  <input
                    placeholder="Min"
                    type="number"
                    step="any"
                    value={maleMin}
                    onChange={(e) => setMaleMin(e.target.value)}
                  />
                  <input
                    placeholder="Max"
                    type="number"
                    step="any"
                    value={maleMax}
                    onChange={(e) => setMaleMax(e.target.value)}
                  />
                  <div style={{ fontWeight: 600 }}>F</div>
                  <input
                    placeholder="Min"
                    type="number"
                    step="any"
                    value={femaleMin}
                    onChange={(e) => setFemaleMin(e.target.value)}
                  />
                  <input
                    placeholder="Max"
                    type="number"
                    step="any"
                    value={femaleMax}
                    onChange={(e) => setFemaleMax(e.target.value)}
                  />
                </div>
              )}
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Normal value shown as:{' '}
                {!useNamedRanges
                  ? rangeMin && rangeMax
                    ? `${rangeMin} - ${rangeMax}`
                    : rangeMin
                      ? `>= ${rangeMin}`
                      : rangeMax
                        ? `<= ${rangeMax}`
                        : '—'
                  : [
                      maleMin || maleMax
                        ? `M: ${maleMin && maleMax ? `${maleMin} - ${maleMax}` : maleMin ? `>= ${maleMin}` : `<= ${maleMax}`}`
                        : '',
                      femaleMin || femaleMax
                        ? `F: ${femaleMin && femaleMax ? `${femaleMin} - ${femaleMax}` : femaleMin ? `>= ${femaleMin}` : `<= ${femaleMax}`}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
              </div>
            </div>
          )}
          {/* Representation override: saved into normal_value */}
          <input
            placeholder="Representation (e.g., 10 TO 15)"
            value={newNormalDisplay}
            onChange={(e) => setNewNormalDisplay(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
            aria-label="Representation override"
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
            <button
              type="button"
              className="btn-win"
              disabled={saving}
              onClick={async () => {
                try {
                  const res = await window.conveyor.app.exportLogs('json')
                  setReseedStatus(`Logs exported (${res.count}) to ${res.filePath}`)
                } catch (e) {
                  console.error('Log export failed', e)
                  setReseedStatus('Log export failed')
                }
              }}
              aria-label="Export logs JSON"
            >
              Logs JSON
            </button>
            <button
              type="button"
              className="btn-win"
              disabled={saving}
              onClick={async () => {
                try {
                  const res = await window.conveyor.app.exportLogs('txt')
                  setReseedStatus(`Logs exported (${res.count}) to ${res.filePath}`)
                } catch (e) {
                  console.error('Log export failed', e)
                  setReseedStatus('Log export failed')
                }
              }}
              aria-label="Export logs TXT"
            >
              Logs TXT
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
      <TestsTable groups={groups} setGroups={setGroups} load={load} onEdit={openEdit} />
      {editOpen && editRow && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit Normal">
          <div className="modal-dialog">
            <h3>Edit Normal — {editRow.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div role="radiogroup" aria-label="Normal type" style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="edit-type"
                    value="text"
                    checked={editType === 'text'}
                    onChange={() => setEditType('text')}
                  />
                  <span>Text</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="edit-type"
                    value="options"
                    checked={editType === 'options'}
                    onChange={() => setEditType('options')}
                  />
                  <span>Options</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="edit-type"
                    value="range"
                    checked={editType === 'range'}
                    onChange={() => setEditType('range')}
                  />
                  <span>Range</span>
                </label>
              </div>
              {editType === 'text' && (
                <input placeholder="Normal value" value={editText} onChange={(e) => setEditText(e.target.value)} />
              )}
              {editType === 'options' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      placeholder="Add an option"
                      value={editOptionInput}
                      onChange={(e) => setEditOptionInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-win"
                      onClick={() => {
                        const v = editOptionInput.trim()
                        if (!v) return
                        setEditOptions((list) => (list.some((x) => x.label === v) ? list : [...list, { label: v }]))
                        setEditOptionInput('')
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  {editOptions.length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 120px auto',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      {editOptions.map((opt, idx) => (
                        <React.Fragment key={opt.label}>
                          <span className="badge-win" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {opt.label}
                          </span>
                          <input
                            type="color"
                            value={opt.color || '#000000'}
                            onChange={(e) => {
                              const color = e.target.value
                              setEditOptions((list) => list.map((o, i) => (i === idx ? { ...o, color } : o)))
                            }}
                          />
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Quick colors">
                            {COLOR_PALETTE.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setEditOptions((list) => list.map((o, i) => (i === idx ? { ...o, color: c } : o)))
                                }
                                title={c}
                                aria-label={`Set color ${c} for ${opt.label}`}
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  border: '1px solid #ccc',
                                  backgroundColor: c,
                                  cursor: 'pointer',
                                }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            className="btn-win btn-secondary"
                            style={{ padding: '0 6px' }}
                            onClick={() => setEditOptions((list) => list.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {editType === 'range' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={editUseNamed} onChange={(e) => setEditUseNamed(e.target.checked)} />
                    <span>Named ranges (M/F)</span>
                  </label>
                  {!editUseNamed ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        placeholder="Min"
                        type="number"
                        step="any"
                        value={editRangeMin}
                        onChange={(e) => setEditRangeMin(e.target.value)}
                      />
                      <input
                        placeholder="Max"
                        type="number"
                        step="any"
                        value={editRangeMax}
                        onChange={(e) => setEditRangeMax(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 6, alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>M</div>
                      <input
                        placeholder="Min"
                        type="number"
                        step="any"
                        value={editMaleMin}
                        onChange={(e) => setEditMaleMin(e.target.value)}
                      />
                      <input
                        placeholder="Max"
                        type="number"
                        step="any"
                        value={editMaleMax}
                        onChange={(e) => setEditMaleMax(e.target.value)}
                      />
                      <div style={{ fontWeight: 600 }}>F</div>
                      <input
                        placeholder="Min"
                        type="number"
                        step="any"
                        value={editFemaleMin}
                        onChange={(e) => setEditFemaleMin(e.target.value)}
                      />
                      <input
                        placeholder="Max"
                        type="number"
                        step="any"
                        value={editFemaleMax}
                        onChange={(e) => setEditFemaleMax(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-win" onClick={submitEdit}>
                Save
              </button>
              <button
                type="button"
                className="btn-win btn-secondary"
                onClick={() => {
                  setEditOpen(false)
                  setEditRow(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

// Memoized heavy table to avoid re-render when Add Test inputs change
const TestsTable: React.FC<{
  groups: GroupedTests[]
  setGroups: React.Dispatch<React.SetStateAction<GroupedTests[]>>
  load: () => Promise<void>
  onEdit: (row: TestRow, category: string) => void
}> = React.memo(({ groups, setGroups, load, onEdit }) => {
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)

  const handleUpdateNormal = useCallback(
    async (category: string, id: number, normal: string) => {
      // optimistic update (parent or child)
      setGroups((prev) =>
        prev.map((grp) =>
          grp.category === category
            ? {
                ...grp,
                tests: grp.tests.map((row) => {
                  if (row.id === id) return { ...row, normal_value: normal, normal_display: normal }
                  if (row.children && row.children.length)
                    return {
                      ...row,
                      children: row.children.map((c) =>
                        c.id === id ? { ...c, normal_value: normal, normal_display: normal } : c
                      ),
                    }
                  return row
                }),
              }
            : grp
        )
      )
      try {
        await window.conveyor.app.updateTestNormal(id, normal)
      } catch (err) {
        console.error('Failed to update normal', err)
        // revert on failure by reloading group
        await load()
      }
    },
    [load, setGroups]
  )

  const AddChildEditor: React.FC<{
    category: string
    parentId: number
    onAdded: () => void
    onCancel: () => void
  }> = React.memo(({ category, parentId, onAdded, onCancel }) => {
    const [name, setName] = useState('')
    const [kind, setKind] = useState<NormalType>('text')
    const [textVal, setTextVal] = useState('')
    const [opts, setOpts] = useState<OptItem[]>([])
    const [optInput, setOptInput] = useState('')
    const [rmin, setRmin] = useState('')
    const [rmax, setRmax] = useState('')
    const [named, setNamed] = useState(false)
    const [mmin, setMmin] = useState('')
    const [mmax, setMmax] = useState('')
    const [fmin, setFmin] = useState('')
    const [fmax, setFmax] = useState('')
    const [rep, setRep] = useState('')
    const [saving, setSaving] = useState(false)

    const toNumber = (s?: string) => {
      const v = (s || '').trim()
      return v ? Number(v) : undefined
    }

    const buildSpec = (): string | null => {
      if (kind === 'text') return null
      if (kind === 'options') {
        const list = opts.map((o) => ({ label: (o.label || '').trim(), color: o.color })).filter((o) => !!o.label)
        return list.length ? JSON.stringify({ type: 'options', options: list }) : null
      }
      // range
      if (named) {
        const male = mmin || mmax ? { min: toNumber(mmin), max: toNumber(mmax) } : undefined
        const female = fmin || fmax ? { min: toNumber(fmin), max: toNumber(fmax) } : undefined
        return male || female ? JSON.stringify({ type: 'sexed-range', male, female }) : null
      }
      const range = rmin || rmax ? { min: toNumber(rmin), max: toNumber(rmax) } : undefined
      return range ? JSON.stringify({ type: 'range', range }) : null
    }

    const handleAdd = async () => {
      if (!name.trim()) return
      setSaving(true)
      try {
        const spec = buildSpec()
        const repVal = rep.trim()
        await window.conveyor.app.addChildTest(category, parentId, name.trim(), repVal, spec)
        await onAdded()
      } catch (e) {
        console.error('Failed to add child', e)
      } finally {
        setSaving(false)
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Child test name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="win-inline-input"
            style={{ width: 220 }}
          />
          <div role="radiogroup" aria-label="Normal type" style={{ display: 'flex', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" checked={kind === 'text'} onChange={() => setKind('text')} />
              <span>Text</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" checked={kind === 'options'} onChange={() => setKind('options')} />
              <span>Options</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" checked={kind === 'range'} onChange={() => setKind('range')} />
              <span>Range</span>
            </label>
          </div>
        </div>
        {kind === 'text' && (
          <input
            placeholder="Normal value"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            className="win-inline-input"
            style={{ width: 280 }}
          />
        )}
        {kind === 'options' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Add an option"
                value={optInput}
                onChange={(e) => setOptInput(e.target.value)}
                className="win-inline-input"
                style={{ width: 220 }}
              />
              <button
                type="button"
                className="btn-win"
                onClick={() => {
                  const v = optInput.trim()
                  if (!v) return
                  setOpts((list) => (list.some((x) => x.label === v) ? list : [...list, { label: v }]))
                  setOptInput('')
                }}
              >
                + Add
              </button>
            </div>
            {opts.length > 0 && (
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 6, alignItems: 'center' }}
              >
                {opts.map((opt, idx) => (
                  <React.Fragment key={opt.label}>
                    <span className="badge-win" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {opt.label}
                    </span>
                    <input
                      type="color"
                      value={opt.color || '#000000'}
                      onChange={(e) =>
                        setOpts((list) => list.map((o, i) => (i === idx ? { ...o, color: e.target.value } : o)))
                      }
                    />
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Quick colors">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setOpts((list) => list.map((o, i) => (i === idx ? { ...o, color: c } : o)))}
                          title={c}
                          aria-label={`Set color ${c} for ${opt.label}`}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: '1px solid #ccc',
                            backgroundColor: c,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn-win btn-secondary"
                      style={{ padding: '0 6px' }}
                      onClick={() => setOpts((list) => list.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
        {kind === 'range' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} />
              <span>Named ranges (M/F)</span>
            </label>
            {!named ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder="Min"
                  type="number"
                  step="any"
                  value={rmin}
                  onChange={(e) => setRmin(e.target.value)}
                  className="win-inline-input"
                  style={{ width: 120 }}
                />
                <input
                  placeholder="Max"
                  type="number"
                  step="any"
                  value={rmax}
                  onChange={(e) => setRmax(e.target.value)}
                  className="win-inline-input"
                  style={{ width: 120 }}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 6, alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>M</div>
                <input
                  placeholder="Min"
                  type="number"
                  step="any"
                  value={mmin}
                  onChange={(e) => setMmin(e.target.value)}
                  className="win-inline-input"
                />
                <input
                  placeholder="Max"
                  type="number"
                  step="any"
                  value={mmax}
                  onChange={(e) => setMmax(e.target.value)}
                  className="win-inline-input"
                />
                <div style={{ fontWeight: 600 }}>F</div>
                <input
                  placeholder="Min"
                  type="number"
                  step="any"
                  value={fmin}
                  onChange={(e) => setFmin(e.target.value)}
                  className="win-inline-input"
                />
                <input
                  placeholder="Max"
                  type="number"
                  step="any"
                  value={fmax}
                  onChange={(e) => setFmax(e.target.value)}
                  className="win-inline-input"
                />
              </div>
            )}
          </div>
        )}
        {/* Representation override for child */}
        <input
          placeholder="Representation (e.g., 10 TO 15)"
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          className="win-inline-input"
          style={{ width: 280 }}
          aria-label="Child representation override"
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-win" disabled={saving || !name.trim()} onClick={handleAdd}>
            Create
          </button>
          <button type="button" className="btn-win btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  })

  return (
    <div>
      {groups.map((g) => (
        <div key={g.category} style={{ marginBottom: 18 }}>
          <h4 style={{ margin: '8px 0 6px', fontFamily: 'Cambria,serif' }}>{g.category}</h4>
          <div className="tests-table-wrap">
            <table className="win-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Name</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Required</th>
                  <th>Normal</th>
                </tr>
              </thead>
              <tbody>
                {g.tests.map((t) => {
                  const parentRow = (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>{t.name}</strong>
                          <button
                            type="button"
                            className="btn-win btn-secondary"
                            style={{ padding: '2px 6px', fontSize: 12 }}
                            onClick={() => onEdit(t, g.category)}
                            aria-label={`Edit normal for ${t.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-win btn-secondary"
                            style={{ padding: '2px 6px', fontSize: 12 }}
                            onClick={() => setAddingChildFor((cur) => (cur === t.id ? null : t.id))}
                            aria-label={`Add child test for ${t.name}`}
                          >
                            {addingChildFor === t.id ? 'Close' : 'Add Sub-Test'}
                          </button>
                        </div>
                      </td>
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
                          defaultValue={t.normal_display || ''}
                          aria-label={`Normal value for ${t.name}`}
                          className="win-inline-input"
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val !== (t.normal_value || '')) {
                              handleUpdateNormal(g.category, t.id, val)
                            }
                          }}
                        />
                      </td>
                    </tr>
                  )

                  const reloadAndClose = async () => {
                    await load()
                    setAddingChildFor(null)
                  }

                  const addChildRow =
                    addingChildFor === t.id ? (
                      <tr key={`add-${t.id}`}>
                        <td colSpan={3}>
                          <AddChildEditor
                            category={g.category}
                            parentId={t.id}
                            onAdded={reloadAndClose}
                            onCancel={() => setAddingChildFor(null)}
                          />
                        </td>
                      </tr>
                    ) : null

                  const childRows = (t.children || []).map((ch) => (
                    <tr key={ch.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
                          <span>{ch.name}</span>
                          <button
                            type="button"
                            className="btn-win btn-secondary"
                            style={{ padding: '2px 6px', fontSize: 12 }}
                            onClick={() => onEdit(ch, g.category)}
                            aria-label={`Edit normal for ${ch.name}`}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Switch
                          checked={!!ch.required}
                          onCheckedChange={async (val) => {
                            // optimistic update
                            setGroups((prev) =>
                              prev.map((grp) =>
                                grp.category === g.category
                                  ? {
                                      ...grp,
                                      tests: grp.tests.map((row) =>
                                        row.id === t.id
                                          ? {
                                              ...row,
                                              children: (row.children || []).map((c) =>
                                                c.id === ch.id ? { ...c, required: val } : c
                                              ),
                                            }
                                          : row
                                      ),
                                    }
                                  : grp
                              )
                            )
                            try {
                              await window.conveyor.app.updateTestRequired(ch.id, !!val)
                            } catch (err) {
                              console.error('Failed to update required', err)
                              // revert on failure
                              setGroups((prev) =>
                                prev.map((grp) =>
                                  grp.category === g.category
                                    ? {
                                        ...grp,
                                        tests: grp.tests.map((row) =>
                                          row.id === t.id
                                            ? {
                                                ...row,
                                                children: (row.children || []).map((c) =>
                                                  c.id === ch.id ? { ...c, required: ch.required } : c
                                                ),
                                              }
                                            : row
                                        ),
                                      }
                                    : grp
                                )
                              )
                            }
                          }}
                          aria-label={`Toggle required for ${ch.name}`}
                        />
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <input
                          defaultValue={ch.normal_display || ''}
                          aria-label={`Normal value for ${ch.name}`}
                          className="win-inline-input"
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val !== (ch.normal_value || '')) {
                              handleUpdateNormal(g.category, ch.id, val)
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))

                  return (
                    <React.Fragment key={`row-${t.id}`}>
                      {parentRow}
                      {addChildRow}
                      {childRows}
                    </React.Fragment>
                  )
                })}
                {g.tests.length === 0 && (
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
  )
})
