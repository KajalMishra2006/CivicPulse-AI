import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import { IconShield, IconArrowLeft, IconArrowRight } from './Icons.jsx'
import './App.css'

function OfficialLogin({ onBackToCitizenLogin, onBackToHome, onGoToVerificationRequest }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter your official email and password.')
      return
    }

    setIsSubmitting(true)
    try {
      console.log('[GOV LOGIN] Submitting login request for:', email.trim())
      await login(email.trim(), password)
      console.log('[GOV LOGIN] Login succeeded')
    } catch (err) {
      console.error('[GOV LOGIN ERROR]', {
        code: err?.code,
        message: err?.message,
        operation: 'OfficialLogin (signInWithEmailAndPassword)'
      })
      setError(formatAuthError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-view-page govbridge-auth-page">
      {/* 1. TOP NAVBAR / HEADER */}
      <header className="auth-top-header">
        <div className="auth-header-brand">
          <div
            className="govbridge-nav-brand"
            onClick={onBackToHome || onBackToCitizenLogin}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          </div>
          <button
            type="button"
            className="auth-nav-link-btn govbridge-back-home-btn"
            onClick={onBackToHome || onBackToCitizenLogin}
          >
            <IconArrowLeft size={14} />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN CENTERED CARD */}
      <main className="auth-center-container">
        <div className="auth-center-card-wrapper">
          <div className="signup-card auth-card-transition" style={{ maxWidth: '480px' }}>
            {/* Role Switcher Tabs */}
            <div className="govbridge-auth-role-tabs">
              <button
                type="button"
                className="auth-role-tab"
                onClick={onBackToCitizenLogin}
              >
                Citizen
              </button>
              <button
                type="button"
                className="auth-role-tab active"
              >
                Government Official
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', color: '#071B3A', fontWeight: 800 }}>
                Government Official Sign In
              </h1>
              <p className="signup-description" style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                Unified portal for Super Admins, State Admins, and District Officers.
              </p>
            </div>

            {error && <p className="error-message main-error">{error}</p>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="location-field">
                <label>Official Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. officer@gov.in or admin@govbridge.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="location-field">
                <label>Password *</label>
                <input
                  type="password"
                  placeholder="Enter your official password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="primary-button"
                style={{ width: '100%', marginTop: '16px' }}
              >
                {isSubmitting ? 'Authenticating Official Session...' : 'Sign In as Government Official'}
              </button>
            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>
                New government employee, municipal officer, or regional administrator?
              </p>
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%', marginTop: 0 }}
                onClick={() => onGoToVerificationRequest(email, '')}
              >
                <IconShield size={16} />
                <span>Request Government Employee / Admin Access</span>
                <IconArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OfficialLogin
