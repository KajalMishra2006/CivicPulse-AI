import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import { getTranslation } from './utils/translations.js'
import LanguageSelector from './LanguageSelector.jsx'
import './App.css'

function Login({ onBackToSignup, onLogin, onGoToOfficialLogin }) {
  const { login, googleLogin, preferredLanguage, setLanguage } = useAuth()
  const activeLanguage = preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError(t.enterEmail || 'Please enter your email address')
      return
    }
    if (!password) {
      setError(t.enterPassword || 'Please enter your password')
      return
    }

    setIsSubmitting(true)
    try {
      await login(email, password)
      if (onLogin) onLogin()
    } catch (err) {
      console.error('[AUTH ERROR]', {
        code: err?.code,
        message: err?.message,
        operation: 'Login (signInWithEmailAndPassword)',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
      })
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
      console.error('[AUTH ERROR]', {
        code: err?.code,
        message: err?.message,
        operation: 'Login (signInWithPopup Google)',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
      })
      setError(formatAuthError(err))
    }
  }

  return (
    <div className="auth-view-page">
      {/* 1. TOP NAVBAR / HEADER */}
      <header className="auth-top-header">
        <div className="auth-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2>
            CivicPulse<span className="brand-accent">-AI</span>
          </h2>
          <button
            type="button"
            className="auth-nav-link-btn"
            onClick={onBackToSignup}
          >
            ← {t.home || 'Home'}
          </button>
        </div>

        <LanguageSelector
          currentLanguage={activeLanguage}
          onSelectLanguage={setLanguage}
          variant="light"
        />
      </header>

      {/* 2. MAIN TWO-COLUMN SECTION */}
      <div className="auth-split-container">
        {/* Left Side: Civic-Tech Branding Hero with 3 Differentiating Capabilities */}
        <div className="auth-hero-left">
          <div className="auth-hero-badge">
            🏛️ Civic Technology Platform
          </div>

          <h1 className="auth-hero-title">
            {t.reportTrackImprove || 'Report. Track. Improve.'}
          </h1>

          <p className="auth-hero-description">
            {t.loginHeroDesc || 'Empowering citizens and municipal teams to resolve community infrastructure issues faster with AI triage and multilingual accessibility.'}
          </p>

          <div className="auth-feature-card-grid">
            {/* Feature 1: Gemini AI Priority Triage */}
            <div className="auth-feature-card">
              <div className="feature-card-header">
                <span className="feature-icon" aria-hidden="true">✨</span>
                <h3>{t.feature1Title || 'Gemini AI Priority Triage'}</h3>
              </div>
              <p>
                {t.feature1Desc || 'AI analyzes reported civic issues and helps prioritize them according to severity and urgency.'}
              </p>
            </div>

            {/* Feature 2: 8 Indian Languages + Dynamic Translation */}
            <div className="auth-feature-card">
              <div className="feature-card-header">
                <span className="feature-icon" aria-hidden="true">🌐</span>
                <h3>{t.feature2Title || '8 Indian Languages + Dynamic Translation'}</h3>
              </div>
              <p>
                {t.feature2Desc || 'Citizens can use the platform in supported Indian languages, while complaint descriptions can be dynamically translated for government teams.'}
              </p>
            </div>

            {/* Feature 3: Speech-to-Text & Audio Listeners */}
            <div className="auth-feature-card">
              <div className="feature-card-header">
                <span className="feature-icon" aria-hidden="true">🎤</span>
                <h3>{t.feature3Title || 'Speech-to-Text & Audio Listeners'}</h3>
              </div>
              <p>
                {t.feature3Desc || 'Citizens can report complaints using voice input and listen to complaint and status updates through audio playback.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Login Card */}
        <div className="auth-card-right">
          <div className="signup-card auth-card-transition">
            <h1>{t.welcomeBack || 'Welcome Back'}</h1>

            <p className="signup-description">
              {t.loginSubtitle || 'Sign in to manage and track community issues.'}
            </p>

            {error && <p className="error-message main-error">{error}</p>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">{t.emailAddress || 'Email Address'}</label>
                <input
                  type="email"
                  placeholder={t.emailPlaceholder || 'name@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.password || 'Password'}</label>
                <input
                  type="password"
                  placeholder={t.passwordPlaceholder || 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="primary-button"
                style={{ width: '100%', marginTop: '6px' }}
              >
                {isSubmitting ? (t.loggingIn || 'Logging In...') : (t.login || 'Login')}
              </button>

              <div className="divider">
                <span>{t.or || 'OR'}</span>
              </div>

              <button
                type="button"
                className="google-button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                {t.continueWithGoogle || 'Continue with Google'}
              </button>
            </form>

            <p className="login-text" style={{ marginTop: '20px' }}>
              {t.dontHaveAccount || "Don't have an account?"}{' '}
              <button type="button" onClick={onBackToSignup}>
                {t.signUp || 'Sign Up'}
              </button>
            </p>

            <p className="login-text" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {t.areYouOfficial || 'Are you a Government Official?'}{' '}
              <button type="button" onClick={onGoToOfficialLogin}>
                {t.officialPortalLogin || '→ Official Portal Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login