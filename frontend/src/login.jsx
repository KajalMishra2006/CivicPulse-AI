import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'

function Login({ onBackToSignup, onLogin, onGoToOfficialLogin }) {
  const { login, googleLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }

    setIsSubmitting(true)
    try {
      await login(email, password)
      if (onLogin) onLogin()
    } catch (err) {
      console.error('Login error:', err)
      setError(formatAuthError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    try {
      await googleLogin()
      if (onLogin) onLogin()
    } catch (err) {
      console.error('Google login error:', err)
      setError(formatAuthError(err))
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Welcome Back</h1>

        <p className="signup-description">
          Login to your CivicPulse-AI account.
        </p>

        {error && <p className="error-message main-error">{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging In...' : 'Login'}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="google-button"
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </button>
        </form>

        <p className="login-text">
          Don't have an account?{' '}
          <button type="button" onClick={onBackToSignup}>
            Sign Up
          </button>
        </p>

        <p className="login-text" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          Are you a Government Official?{' '}
          <button type="button" onClick={onGoToOfficialLogin}>
            → Official Portal Login
          </button>
        </p>
      </div>
    </div>
  )
}

export default Login