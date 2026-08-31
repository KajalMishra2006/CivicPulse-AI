import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import './App.css'

function OfficialLogin({ onBackToCitizenLogin, onGoToVerificationRequest }) {
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
    <div className="signup-page">
      <div className="signup-card" style={{ maxWidth: '480px' }}>
        <button
          type="button"
          className="back-button-styled"
          onClick={onBackToCitizenLogin}
          style={{ marginBottom: '16px' }}
        >
          ← Back to Citizen Portal
        </button>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '32px' }}>🏛️</span>
          <h1 style={{ margin: '8px 0 4px 0', fontSize: '24px' }}>Government Official Sign In</h1>
          <p className="signup-description" style={{ margin: 0 }}>
            Unified portal for Super Admins, State Admins, District Admins, Citizen Access Staff, and Issue Resolution Officers.
          </p>
        </div>

        {error && <p className="error-message main-error">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="location-field">
            <label>Official Email Address *</label>
            <input
              type="email"
              placeholder="e.g. officer@gov.in or admin@civicpulse.gov"
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
            🛡️ Request Government Employee / Admin Access →
          </button>
        </div>
      </div>
    </div>
  )
}

export default OfficialLogin
