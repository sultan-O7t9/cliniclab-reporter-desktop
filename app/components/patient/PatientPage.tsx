import React, { useState, useEffect } from 'react'
// Removed shared Button for custom Windows 10 styled print button

interface PatientForm {
  name: string
  age: string
  sex: string
  fatherOrHusband?: string
}

const initialState: PatientForm = { name: '', age: '', sex: 'Female', fatherOrHusband: '' }

interface TestItem {
  id: number
  name: string
  normal_value?: string | null
  required?: boolean | null
  children?: TestItem[]
}
interface TestGroup {
  id: string
  category: string
  tests: TestItem[]
  selected: Record<number, { result: string }>
  loading: boolean
  breakAfter?: boolean
}

export const PatientPage: React.FC = () => {
  const [form, setForm] = useState<PatientForm>(initialState)
  const [categories, setCategories] = useState<string[]>([])
  const [groups, setGroups] = useState<TestGroup[]>([
    { id: 'g-1', category: '', tests: [], selected: {}, loading: false, breakAfter: false },
  ])

  useEffect(() => {
    let mounted = true
    window.conveyor.app
      .testCategories()
      .then((cats) => mounted && setCategories(cats))
      .catch((e) => console.error('Failed to load categories', e))
    return () => {
      mounted = false
    }
  }, [])

  const groupVisibleTests = (g: TestGroup) => g.tests

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleCategoryChange = (groupId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    loadTestsForGroup(groupId, value)
  }

  const loadTestsForGroup = (groupId: string, category: string) => {
    setGroups((gs) =>
      gs.map((g) => (g.id === groupId ? { ...g, category, loading: !!category, tests: [], selected: {} } : g))
    )
    if (!category) return
    let mounted = true
    window.conveyor.app
      .testsByCategoryNested(category)
      .then((resp) => {
        if (!mounted) return
        const rows: TestItem[] = (resp?.tests as any[]) || []
        // Auto-select required tests (both standalone and children)
        const requiredIds: number[] = []
        const walk = (items: TestItem[]) => {
          for (const it of items) {
            if (it.required) requiredIds.push(it.id)
            if (Array.isArray(it.children) && it.children.length) {
              walk(it.children)
            }
          }
        }
        walk(rows)
        setGroups((gs) =>
          gs.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  tests: rows,
                  loading: false,
                  selected: requiredIds.reduce<Record<number, { result: string }>>((acc, id) => {
                    acc[id] = { result: '' }
                    return acc
                  }, {}),
                }
              : g
          )
        )
      })
      .catch((e) => {
        console.error('Failed to load tests', e)
        setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, loading: false } : g)))
      })
    return () => {
      mounted = false
    }
  }

  const toggleTest = (groupId: string, testId: number) => {
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g
        const selected = { ...g.selected }
        if (selected[testId]) delete selected[testId]
        else selected[testId] = { result: '' }
        return { ...g, selected }
      })
    )
  }

  const updateResult = (groupId: string, testId: number, value: string) => {
    setGroups((gs) =>
      gs.map((g) => (g.id === groupId ? { ...g, selected: { ...g.selected, [testId]: { result: value } } } : g))
    )
  }

  const addGroup = () => {
    setGroups((gs) => {
      if (gs.length) {
        const last = gs[gs.length - 1]
        const hasCategory = !!last.category
        const hasAtLeastOneTest = Object.keys(last.selected).length > 0
        if (!hasCategory || !hasAtLeastOneTest) {
          console.warn(
            '[AddGroup] Cannot add new group until previous group has category and at least one selected test.'
          )
          return gs
        }
      }
      return [
        ...gs,
        { id: `g-${gs.length + 1}`, category: '', tests: [], selected: {}, loading: false, breakAfter: false },
      ]
    })
  }

  const removeGroup = (groupId: string) => {
    setGroups((gs) => {
      if (gs.length === 1)
        return [{ id: 'g-1', category: '', tests: [], selected: {}, loading: false, breakAfter: false }]
      return gs.filter((g) => g.id !== groupId)
    })
  }

  const toggleBreakAfter = (groupId: string) => {
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, breakAfter: !g.breakAfter } : g)))
  }

  // Preview removed per request; direct print only

  const handlePrint = () => {
    const testsPayload = groups
      .filter((g) => g.category)
      .map((g) => {
        // Build nested payload: for each root, include either standalone selection or selected children
        const roots = g.tests
        const items: any[] = []
        const upperPosNeg = (v: string) =>
          v.trim() ? (['negative', 'positive'].includes(v.trim().toLowerCase()) ? v.trim().toUpperCase() : v) : '-'
        const buildForRoot = (root: TestItem) => {
          const hasChildren = Array.isArray(root.children) && root.children.length > 0
          if (hasChildren) {
            const childList = Array.isArray(root.children) ? root.children : []
            const selectedChildren = childList
              .filter((ch) => g.selected[ch.id])
              .map((ch) => ({
                name: ch.name,
                result: upperPosNeg(g.selected[ch.id]?.result || ''),
                normal: ch.normal_value || '',
              }))
            if (selectedChildren.length) {
              items.push({
                name: root.name,
                category: g.category,
                children: selectedChildren,
              })
            }
          } else {
            if (g.selected[root.id]) {
              items.push({
                name: root.name,
                result: upperPosNeg(g.selected[root.id]?.result || ''),
                normal: root.normal_value || '',
                category: g.category,
              })
            }
          }
        }
        roots.forEach(buildForRoot)
        return { category: g.category, tests: items, breakAfter: !!g.breakAfter }
      })
      .filter((g) => g.tests.length)
    if (!testsPayload.length) {
      console.warn('[Report] No test results entered; nothing to print.')
      return
    }
    const report = {
      patient: { ...form },
      tests: testsPayload,
      generatedAt: new Date().toISOString(),
    }
    console.warn('[Report]', report)
    window.conveyor.app
      .saveTestRecord(report)
      .then(async (res: any) => {
        console.warn('[Report Saved] id=', res?.id)
        try {
          const printRes = await window.conveyor.app.printReport(report)
          if (!printRes?.printed) {
            console.error('Print failed', printRes?.error)
          }
        } catch (e) {
          console.error('Failed to print report', e)
        }
      })
      .catch((err: any) => console.error('Failed to save test record', err))
  }

  return (
    <div className="patient-page">
      <header className="panel-header">
        <h1>Patient</h1>
      </header>
      <section className="panel-body">
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="name">Patient Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name?.toUpperCase()}
              onChange={handleChange}
              placeholder="Enter full name"
              autoComplete="off"
            />
          </div>
          <div className="form-field">
            <label htmlFor="age">Age</label>
            <input id="age" name="age" type="number" value={form.age} onChange={handleChange} min={0} />
          </div>
          <div className="form-field">
            <label>Sex</label>
            <div className="radio-group" role="radiogroup" aria-label="Sex">
              <label className="radio-option">
                <input type="radio" name="sex" value="Male" checked={form.sex === 'Male'} onChange={handleChange} />
                <span className="radio-bullet" aria-hidden="true" />
                <span>Male</span>
              </label>
              <label className="radio-option">
                <input type="radio" name="sex" value="Female" checked={form.sex === 'Female'} onChange={handleChange} />
                <span className="radio-bullet" aria-hidden="true" />
                <span>Female</span>
              </label>
            </div>
          </div>

          {/* Row break to push following fields to next line without making them full width */}
          <div style={{ gridColumn: '1 / -1', height: 0, padding: 0, margin: 0 }} aria-hidden="true" />
          <div className="form-field">
            <label htmlFor="fatherOrHusband">Father/Husband</label>
            <input
              id="fatherOrHusband"
              name="fatherOrHusband"
              type="text"
              value={form.fatherOrHusband || ''}
              onChange={handleChange}
              placeholder="Enter Father/Husband name"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="divider" role="separator" />
        <div>
          <div className="test-groups">
            {groups.map((g, gi) => {
              const tests = groupVisibleTests(g)
              return (
                <div key={g.id} style={{ marginTop: gi === 0 ? 24 : 32 }}>
                  <div className="form-grid" style={{ position: 'relative' }}>
                    <div className="form-field" style={{ paddingRight: 32 }}>
                      <label htmlFor={`testCategory-${g.id}`}>Test</label>
                      <select
                        id={`testCategory-${g.id}`}
                        value={g.category}
                        onChange={(e) => handleCategoryChange(g.id, e)}
                      >
                        <option value="">Select</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="delete-group-btn"
                      onClick={() => removeGroup(g.id)}
                      aria-label="Delete Test Group"
                      title="Delete this test category group"
                      tabIndex={-1}
                      style={{ position: 'absolute', top: 0, right: 0, cursor: 'pointer' }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                  {g.category && tests.length > 0 && (
                    <div className="test-rows" style={{ marginTop: 20 }}>
                      {tests
                        .slice()
                        .sort((a: any, b: any) => {
                          const ao = typeof (a as any).sort_order === 'number' ? (a as any).sort_order : 999999
                          const bo = typeof (b as any).sort_order === 'number' ? (b as any).sort_order : 999999
                          if (ao !== bo) return ao - bo
                          if (typeof (a as any).id === 'number' && typeof (b as any).id === 'number' && a.id !== b.id)
                            return (a as any).id - (b as any).id
                          return String((a as any).name).localeCompare(String((b as any).name))
                        })
                        .map((t) => {
                          const hasChildren = Array.isArray(t.children) && t.children.length > 0
                          if (!hasChildren) {
                            const checked = !!g.selected[t.id]
                            const checkboxId = `test-${g.id}-${t.id}`
                            return (
                              <div key={t.id}>
                                <div className={'test-row-main' + (checked ? ' selected' : '')}>
                                  <label
                                    htmlFor={checkboxId}
                                    className="test-row-label"
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                  >
                                    <input
                                      id={checkboxId}
                                      type="checkbox"
                                      className="test-row-check"
                                      checked={checked}
                                      onChange={() => toggleTest(g.id, t.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          toggleTest(g.id, t.id)
                                        }
                                      }}
                                      aria-label={`Select ${t.name}`}
                                    />
                                    <div
                                      className="test-row-name"
                                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                      <span>{t.name}</span>
                                    </div>
                                  </label>
                                  {checked ? (
                                    <input
                                      type="text"
                                      className="test-row-result"
                                      placeholder="Result"
                                      value={g.selected[t.id]?.result || ''}
                                      onChange={(e) => updateResult(g.id, t.id, e.target.value)}
                                    />
                                  ) : (
                                    <div className="test-row-result-placeholder" />
                                  )}
                                  <p>{t.normal_value || ''}</p>
                                </div>
                                <p></p>
                              </div>
                            )
                          }
                          // Parent with children: render parent label row (no checkbox/input), then child rows
                          const parentRow = (
                            <div key={`p-${t.id}`}>
                              <div className={'test-row-main'}>
                                <div
                                  className="test-row-label"
                                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                                >
                                  <div
                                    className="test-row-name"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                                  </div>
                                </div>
                                <div className="test-row-result-placeholder" />
                                <p>{t.normal_value || ''}</p>
                              </div>
                              <p></p>
                            </div>
                          )
                          const childRows = (t.children || [])
                            .slice()
                            .sort((a: any, b: any) => {
                              const ao = typeof a.sort_order === 'number' ? a.sort_order : 999999
                              const bo = typeof b.sort_order === 'number' ? b.sort_order : 999999
                              if (ao !== bo) return ao - bo
                              if (typeof a.id === 'number' && typeof b.id === 'number' && a.id !== b.id)
                                return a.id - b.id
                              return String(a.name).localeCompare(String(b.name))
                            })
                            .map((ch) => {
                              const checked = !!g.selected[ch.id]
                              const checkboxId = `test-${g.id}-${ch.id}`
                              return (
                                <div key={ch.id}>
                                  <div className={'test-row-main' + (checked ? ' selected' : '')}>
                                    <label
                                      htmlFor={checkboxId}
                                      className="test-row-label"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        cursor: 'pointer',
                                        paddingLeft: 16,
                                      }}
                                    >
                                      <input
                                        id={checkboxId}
                                        type="checkbox"
                                        className="test-row-check"
                                        checked={checked}
                                        onChange={() => toggleTest(g.id, ch.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            toggleTest(g.id, ch.id)
                                          }
                                        }}
                                        aria-label={`Select ${ch.name}`}
                                      />
                                      <div
                                        className="test-row-name"
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                      >
                                        <span>{ch.name}</span>
                                      </div>
                                    </label>
                                    {checked ? (
                                      <input
                                        type="text"
                                        className="test-row-result"
                                        placeholder="Result"
                                        value={g.selected[ch.id]?.result || ''}
                                        onChange={(e) => updateResult(g.id, ch.id, e.target.value)}
                                      />
                                    ) : (
                                      <div className="test-row-result-placeholder" />
                                    )}
                                    <p>{ch.normal_value || ''}</p>
                                  </div>
                                  <p></p>
                                </div>
                              )
                            })
                          return (
                            <React.Fragment key={`group-${t.id}`}>
                              {parentRow}
                              {childRows}
                            </React.Fragment>
                          )
                        })}
                    </div>
                  )}
                  {g.category && tests.length === 0 && !g.loading && (
                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>No tests found.</div>
                  )}
                  {g.loading && <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Loading tests...</div>}
                  {/* Break toggle button (affects rendering order in PDF/print) */}
                  {g.category && g.category.toLowerCase() !== 'urine report' ? (
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggleBreakAfter(g.id)}
                        className="btn-win btn-toggle-break"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        aria-pressed={g.breakAfter ? 'true' : 'false'}
                        aria-label={g.breakAfter ? 'Remove line break after group' : 'Add line break after group'}
                        title={
                          g.breakAfter ? 'Line break enabled (click to disable)' : 'Add a line break after this group'
                        }
                      >
                        {g.breakAfter ? 'Break Added ✓' : 'Add Line Break'}
                      </button>
                    </div>
                  ) : null}
                  {g.breakAfter && <div aria-hidden="true" className="group-break-separator" />}
                </div>
              )
            })}

            <div style={{ marginTop: 16, paddingBottom: 16 }}>
              <button type="button" className="add-test-group-btn" onClick={addGroup} aria-label="Add Test Group">
                + Add Test
              </button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="print-report-btn"
            onClick={handlePrint}
            disabled={!groups.some((g) => Object.values(g.selected).some((v) => v.result && v.result.trim().length))}
            aria-label="Print Report"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="print-icon"
            >
              <path d="M6 9V2h12v7" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v8H6z" />
            </svg>
            <span>Print Report</span>
          </button>
        </div>
      </section>
    </div>
  )
}

export default PatientPage
