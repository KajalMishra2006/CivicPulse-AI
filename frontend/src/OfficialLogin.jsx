import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import { IconBuilding, IconShield, IconArrowLeft, IconArrowRight } from './Icons.jsx'
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
          style={{ marginBottom: '18px' }}
        >
          <IconArrowLeft size={15} />
          <span>Back to Citizen Portal</span>
        </button>

        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img
              src="/govbridge-logo.png"
              alt="GovBridge"
              style={{ width: '200px', height: 'auto', maxHeight: '52px', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#071B3A', fontWeight: 800 }}>
            Government Official Sign In
          </h1>
          <p className="signup-description" style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            Unified portal for Super Admins, State Admins, District Admins, Citizen Access Staff, and Issue Resolution Officers.
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
  )
}

export default OfficialLogin
