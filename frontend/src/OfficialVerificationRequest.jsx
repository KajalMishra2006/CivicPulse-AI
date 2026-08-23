import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import { submitVerificationRequest } from './firebase/verification.js'
import './App.css'

function OfficialVerificationRequest({ onBackToOfficialLogin, initialEmail = '', initialName = '' }) {
  const { currentUser, login, register, logout } = useAuth()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [organization, setOrganization] = useState('')
  const [department, setDepartment] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (
      !name.trim() ||
      !email.trim() ||
      !organization.trim() ||
      !department.trim() ||
      !employeeId.trim() ||
      !reason.trim()
    ) {
      setError('Please fill in all required verification fields.')
      return
    }

    setIsSubmitting(true)
    try {
      let effectiveUserId = currentUser?.uid

      // If user is not authenticated, authenticate with provided password
      if (!effectiveUserId) {
        if (!password) {
          setError('Please enter your account password to verify your identity.')
          setIsSubmitting(false)
          return
        }

        try {
          const loggedUser = await login(email, password)
          effectiveUserId = loggedUser.uid
        } catch (authErr) {
          // If no account exists yet, create the user profile with default role
          try {
            const newUser = await register(name, email, password, '', '', '')
            effectiveUserId = newUser.uid
          } catch (regErr) {
            throw new Error(formatAuthError(regErr))
          }
        }
      }

      await submitVerificationRequest({
        userId: effectiveUserId,
        name,
        email,
        organization,
        department,
        employeeId,
        reason
      })

      setIsSubmitted(true)
    } catch (err) {
      console.error('Verification submission error:', err)
      setError(err.message || 'Failed to submit verification request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBackToLogin() {
    // Clean up session if returning to login
    try {
      await logout()
    } catch {
      // ignore
    }
    if (onBackToOfficialLogin) onBackToOfficialLogin()
  }

  if (isSubmitted) {
    return (
      <div className="signup-page">
        <div className="signup-card" style={{ maxWidth: '540px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h1 style={{ fontSize: '26px' }}>Request Submitted</h1>
          <p className="signup-description" style={{ color: '#d1fae5', fontSize: '15px' }}>
            Your verification request has been submitted. An administrator will review your request.
          </p>
          <p style={{ color: '#9eb2c0', fontSize: '14px', lineHeight: '1.6' }}>
            Once approved by a system administrator, you will be granted official access and can log in via the Government Official Portal.
          </p>
          <button
            type="button"
            className="primary-button"
            style={{ width: '100%', marginTop: '20px' }}
            onClick={handleBackToLogin}
          >
            ← Back to Official Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <div className="signup-card" style={{ maxWidth: '540px' }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span className="official-badge" style={{ marginLeft: 0 }}>
            Government Portal
          </span>
        </div>

        <h1 style={{ fontSize: '26px' }}>Official Verification Request</h1>

        <p className="signup-description">
          Request official government access to review and manage civic issues.
        </p>

        {error && <p className="error-message main-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Official Work Email *</label>
            <input
              type="email"
              placeholder="e.g. s.jenkins@citygov.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {!currentUser && (
            <div>
              <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Account Password *</label>
              <input
                type="password"
                placeholder="Enter password for verification account"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          )}

          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Organization / Municipality *</label>
            <input
              type="text"
              placeholder="e.g. Municipal Corporation of Greater Mumbai"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Department *</label>
            <input
              type="text"
              placeholder="e.g. Public Works / Water Supply / Roads"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Employee ID / Badge Number *</label>
            <input
              type="text"
              placeholder="e.g. EMP-98214"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label style={{ color: '#d7e5ed', fontSize: '13px', fontWeight: 'bold' }}>Reason for Access Request *</label>
            <textarea
              placeholder="Describe your role and why you require official dashboard access..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="3"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <button type="submit" disabled={isSubmitting} style={{ marginTop: '8px' }}>
            {isSubmitting ? 'Submitting Request...' : 'Submit Verification Request'}
          </button>
        </form>

        <p className="login-text">
          <button type="button" onClick={handleBackToLogin}>
            ← Back to Official Login
          </button>
        </p>
      </div>
    </div>
  )
}

export default OfficialVerificationRequest
