import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

interface AuthContextValue {
  authed: boolean
  lock: () => void
  login: (password: string) => boolean
  updatePassword: (password: string) => void
  passwordSet: boolean
}

const DEFAULT_PASSWORD = 'BOB00786'
// Admin override password (bypass stored password when entered)
const ADMIN_PASSWORD = '7249'
const LS_KEY = 'app-password'
const LS_LOCK_TS = 'app-last-activity'
// Auto-lock duration (default 10s dev). Can be overridden via localStorage key `app-auto-lock-ms`.
// Accepts integer milliseconds between 3000 (3s) and 86_400_000 (24h).
const AUTO_LOCK_LS_KEY = 'app-auto-lock-ms'
function resolveAutoLockMs(): number {
  try {
    const raw = window.localStorage.getItem(AUTO_LOCK_LS_KEY)
    if (raw) {
      const n = parseInt(raw, 10)
      if (!Number.isNaN(n)) {
        const clamped = Math.min(Math.max(n, 3000), 86_400_000)
        return clamped
      }
    }
  } catch {
    /* ignore */
  }
  return 300000 // default
}
let AUTO_LOCK_MS = resolveAutoLockMs()

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storedPassword, setStoredPassword] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(LS_KEY)
      if (saved && saved.length >= 4) return saved
    } catch {
      /* ignore storage read */
    }
    // Initialize with default if missing
    try {
      window.localStorage.setItem(LS_KEY, DEFAULT_PASSWORD)
    } catch {
      /* ignore init write */
    }
    return DEFAULT_PASSWORD
  })
  const [authed, setAuthed] = useState(false)
  const activityRef = useRef<number>(Date.now())
  const timerRef = useRef<number | null>(null)

  const lock = useCallback(() => {
    setAuthed(false)
  }, [])

  const resetTimer = useCallback(() => {
    activityRef.current = Date.now()
    try {
      window.localStorage.setItem(LS_LOCK_TS, String(activityRef.current))
    } catch {
      /* ignore */
    }
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (Date.now() - activityRef.current >= AUTO_LOCK_MS) {
        lock()
      }
    }, AUTO_LOCK_MS + 50) // slight buffer
  }, [lock])

  // Removed periodic polling; new value will be picked up next successful login.

  const login = (password: string) => {
    // First: admin override
    if (password === ADMIN_PASSWORD) {
      AUTO_LOCK_MS = resolveAutoLockMs()
      setAuthed(true)
      resetTimer()
      return true
    }
    // Normal stored password check
    const ok = password === storedPassword
    if (ok) {
      AUTO_LOCK_MS = resolveAutoLockMs()
      setAuthed(true)
      resetTimer()
    }
    return ok
  }

  const updatePassword = (password: string) => {
    setStoredPassword(password)
    try {
      window.localStorage.setItem(LS_KEY, password)
    } catch {
      /* ignore write */
    }
  }

  // Global activity listeners
  useEffect(() => {
    const onActivity = () => {
      if (!authed) return
      resetTimer()
    }
    const events: (keyof DocumentEventMap)[] = ['click', 'keydown', 'mousemove', 'mousedown', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity))
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [authed, resetTimer])

  const value: AuthContextValue = {
    authed,
    lock,
    login,
    updatePassword,
    passwordSet: !!storedPassword,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
