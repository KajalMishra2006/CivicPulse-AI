import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { getUserProfile, formatAuthError } from './firebase/auth.js'
import { getUserVerificationRequest } from './firebase/verification.js'
import './App.css'

function OfficialLogin({ onBackToCitizenLogin, onGoToVerificationRequest }) {
  const { login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [actionButton, setActionButton] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleOfficialLogin(e) {
    e.preventDefault()
    setError('')
    setActionButton(null)

    if (!email.trim()) {
      setError('Please enter your official email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Authenticate with existing Firebase Auth
      const user = await login(email, password)

      // 2. Load Firestore user profile
      const profile = await getUserProfile(user.uid)

      // 3. Admin check: full access to AdminDashboard
      if (profile?.role === 'admin') {
        return
      }

      // 4. Official check: must have role "official" AND verified: true
      if (profile?.role === 'official' && profile?.verified === true) {
        return
      }

      // 5. Check if user submitted a verification request
      const verificationReq = await getUserVerificationRequest(user.uid, user.email)

      if (verificationReq?.status === 'pending' || (profile?.role === 'official' && !profile?.verified)) {
        await logout()
        setError('Your government verification request is still under review.')
        return
      }

      if (verificationReq?.status === 'rejected') {
        setError('Your government verification request was rejected.')
        setActionButton({
          text: 'Submit New Verification Request →',
          onClick: () => {
            if (onGoToVerificationRequest) {
              onGoToVerificationRequest(user.email, profile?.name || '')
            }
          }
        })
        return
      }

      // 6. Citizen account check
      if (profile?.role === 'citizen' || !profile?.role) {
        setError('This account is a citizen account. Please use Citizen Login or request official verification below.')
        setActionButton({
          text: 'Request Official Verification →',
          onClick: () => {
            if (onGoToVerificationRequest) {
              onGoToVerificationRequest(user.email, profile?.name || '')
            }
          }
        })
        return
      }

      // Fallback
      await logout()
      setError('Access denied. This account does not have government official privileges.')
    } catch (err) {
      console.error('Official login error:', err)
      setError(formatAuthError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span className="official-badge" style={{ marginLeft: 0 }}>
            Government Portal
          </span>
        </div>

        <h1>Official Login</h1>

        <p className="signup-description">
          Secure access for authorized municipal and government personnel.
        </p>

        {error && (
          <div className="error-message main-error" style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px 0', color: '#ff7b7b' }}>{error}</p>
            {actionButton && (
              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: '8px', fontSize: '13px', padding: '6px 14px' }}
                onClick={actionButton.onClick}
              >
                {actionButton.text}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleOfficialLogin}>
          <input
            type="email"
            placeholder="Official Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying Credentials...' : 'Login to Official Portal'}
          </button>
        </form>

        <p className="login-text">
          <button type="button" onClick={onBackToCitizenLogin}>
            ← Back to Citizen Login
          </button>
        </p>

        <p className="login-text" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          Need government access?{' '}
          <button
            type="button"
            onClick={() => {
              if (onGoToVerificationRequest) onGoToVerificationRequest(email)
            }}
          >
            Request Official Verification →
          </button>
        </p>
      </div>
    </div>
  )
}

export default OfficialLogin
