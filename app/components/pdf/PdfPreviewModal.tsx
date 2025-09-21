import React, { useState, useEffect } from 'react'

interface PdfPreviewModalProps {
  open: boolean
  onClose: () => void
  report: any | null
  initialScale?: number
  onConfirmPrint: (finalScale: number) => Promise<void> | void
  generatePreview: (scale: number) => Promise<{ filePath: string; dataUrl?: string } | string>
}

// Map UI quality labels to scale factors (approx)
const SCALE_PRESETS: { label: string; value: number; note: string }[] = [
  { label: 'Draft (0.8x)', value: 0.8, note: 'Faster, lower fidelity' },
  { label: 'Standard (1.0x)', value: 1.0, note: 'Balanced quality' },
  { label: 'High (1.25x)', value: 1.25, note: 'Sharper text & lines' },
  { label: 'Ultra (1.5x)', value: 1.5, note: 'Maximum recommended' },
]

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  onClose,
  report,
  initialScale = 1,
  onConfirmPrint,
  generatePreview,
}) => {
  const [scale, setScale] = useState(initialScale)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!open || !report) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await generatePreview(scale)
        if (cancelled) return
        if (typeof result === 'string') {
          setPreviewUrl(result.startsWith('data:') ? result : `file://${result.replace(/\\/g, '/')}`)
        } else if (result && typeof result === 'object') {
          if (result.dataUrl) setPreviewUrl(result.dataUrl)
          else setPreviewUrl(`file://${result.filePath.replace(/\\/g, '/')}`)
        }
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || 'Failed to generate preview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, report, scale, refreshTick, generatePreview])

  const regenerate = () => setRefreshTick((t) => t + 1)

  if (!open) return null

  return (
    <div className="modal-overlay">
      <div
        className="modal-dialog"
        style={{ width: '1000px', maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span>Print Preview</span>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }}>
            Close
          </button>
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Quality:
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ fontSize: 13 }}>
              {SCALE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={regenerate} disabled={loading} className="btn-secondary" style={{ fontSize: 12 }}>
            {loading ? 'Generating…' : 'Regenerate'}
          </button>
          {error && (
            <span style={{ color: '#b31412', fontSize: 12, fontWeight: 600 }} role="alert">
              {error}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, border: '1px solid #c6c6c6', background: '#fff', position: 'relative' }}>
          {loading && !error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              Generating PDF preview…
            </div>
          )}
          {!loading && !error && previewUrl && (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="PDF Preview"
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button
            className="btn-win"
            onClick={() => onConfirmPrint(scale)}
            disabled={loading || !!error}
            style={{ minWidth: 100 }}
          >
            Print…
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
