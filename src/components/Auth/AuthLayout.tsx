import { useState } from 'react'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import './AuthLayout.css'

type AuthMode = 'login' | 'signup'

export function AuthLayout() {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <div className="auth-layout">
      <div className="auth-background" />
      <div className="auth-dots" />
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
              <path d="M10 22V10h3v9h7v3H10z" fill="white" />
              <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#4F46E5" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-brand-name">Leapcount - AI+</span>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">
              {mode === 'login' ? 'Log in to your account' : 'Create your account'}
            </h1>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Enter your email and password below to log in'
                : 'Enter your details below to create your account'}
            </p>
          </div>

          {mode === 'login' ? (
            <LoginForm onSwitchToSignup={() => setMode('signup')} />
          ) : (
            <SignupForm onSwitchToLogin={() => setMode('login')} />
          )}
        </div>

        <footer className="auth-footer">
          &copy; 2026 Leapcount - AI+. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
