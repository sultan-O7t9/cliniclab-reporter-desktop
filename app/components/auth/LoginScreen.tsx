import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import svgLogo from '@/resources/icons/logo-2.svg'

export const LoginScreen: React.FC = () => {
  const { login } = useAuth()
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const ok = login(pw.trim())
    if (!ok) {
      setError('Incorrect password')
    } else {
      setPw('')
    }
  }

  return (
    <div className="login-surface">
      <form className="login-panel" onSubmit={submit} aria-label="Login Form">
        <div className="login-brand" aria-hidden="true">
          <img
            src={svgLogo}
            alt="Logo"
            className="login-brand-logo"
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              const parent = el.parentElement
              if (parent && !parent.querySelector('.logo-fallback')) {
                const span = document.createElement('span')
                span.textContent = 'Clinic'
                span.className = 'logo-fallback'
                parent.appendChild(span)
              }
            }}
          />
        </div>
        <h1 className="login-heading">Sign In</h1>
        <label className="login-field-label" htmlFor="app-password">
          Password
        </label>
        <input
          ref={inputRef}
          id="app-password"
          type="password"
          className="login-field-input"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Enter password"
          required
        />
        {error && (
          <div className="login-field-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn-win login-submit">
          Sign In
        </button>
      </form>
    </div>
  )
}

export default LoginScreen
