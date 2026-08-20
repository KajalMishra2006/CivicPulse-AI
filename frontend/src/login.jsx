import { useState } from 'react'

function Login({ onBackToSignup, onLogin })  {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

function handleLogin(e) {
  e.preventDefault()

 console.log('HARSH-TEST-123')
  onLogin()
}

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Welcome Back</h1>

        <p className="signup-description">
          Login to your CivicPulse-AI account.
        </p>

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

          <button type="submit">
            Login
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <button type="button" className="google-button">
            Continue with Google
          </button>
        </form>

        <p className="login-text">
          Don't have an account?{' '}
          <button type="button" onClick={onBackToSignup}>
            Sign Up
          </button>
        </p>
      </div>
    </div>
  )
}

export default Login