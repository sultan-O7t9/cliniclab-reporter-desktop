import React, { useState, useMemo, useEffect } from 'react'
// Removed shared Button for custom Windows 10 styled print button

interface PatientForm {
  name: string
  age: string
  sex: string
}

const initialState: PatientForm = { name: '', age: '', sex: 'Female' }

export const PatientPage: React.FC = () => {
  const [form, setForm] = useState<PatientForm>(initialState)
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [selectedTests, setSelectedTests] = useState<Record<string, { result: string }>>({})

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

  useEffect(() => {
    if (!category) {
      setTests([])
      return
    }
    let mounted = true
    window.conveyor.app
      .testsByCategory(category)
      .then((rows) => mounted && setTests(rows))
      .catch((e) => console.error('Failed to load tests', e))
    return () => {
      mounted = false
    }
  }, [category])

  const visibleTests = useMemo(() => tests, [tests])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value)
  }

  const toggleTest = (testName: string) => {
    setSelectedTests((prev) => {
      const copy = { ...prev }
      if (copy[testName]) {
        delete copy[testName]
      } else {
        copy[testName] = { result: '' }
      }
      return copy
    })
  }

  const updateResult = (testName: string, value: string) => {
    setSelectedTests((prev) => ({ ...prev, [testName]: { result: value } }))
  }

  const handlePrint = () => {
    const chosen = Object.keys(selectedTests).map((name) => {
      const meta = tests.find((t) => t.name === name) || {}
      return {
        name,
        result: selectedTests[name].result,
        normal: meta.normal_value || meta.normal || '',
        category: meta.category || category,
      }
    })
    const report = {
      patient: { ...form },
      tests: [{ category, tests: chosen }],
      generatedAt: new Date().toISOString(),
    }
    console.warn('[Report]', report)
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
        </div>
        <div className="divider" role="separator" />
        <div className="form-grid" style={{ marginTop: 24 }}>
          <div className="form-field">
            <label htmlFor="testCategory">Test</label>
            <select id="testCategory" value={category} onChange={handleCategoryChange}>
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        {category && (
          <div className="test-rows" style={{ marginTop: 20 }}>
            {visibleTests.map((t) => {
              const checked = !!selectedTests[t.name]
              const checkboxId = `test-${t.name.replace(/\s+/g, '-').toLowerCase()}`
              return (
                <div key={t.name} className={`test-row ${checked ? 'selected' : ''}`}>
                  <div className="test-row-main">
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
                        onChange={() => toggleTest(t.name)}
                        aria-label={`Select ${t.name}`}
                      />
                      <div className="test-row-name">{t.name}</div>
                    </label>
                    {checked ? (
                      <input
                        type="text"
                        className="test-row-result"
                        placeholder="Result"
                        value={selectedTests[t.name]?.result || ''}
                        onChange={(e) => updateResult(t.name, e.target.value)}
                      />
                    ) : (
                      <div></div>
                    )}
                    <div className="test-row-normal">{t.normal_value || t.normal || ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="print-report-btn"
            onClick={handlePrint}
            disabled={!Object.keys(selectedTests).length}
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
