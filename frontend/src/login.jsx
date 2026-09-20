import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError, sendUserPasswordResetEmail } from './firebase/auth.js'
import { getTranslation } from './utils/translations.js'
import LanguageSelector from './LanguageSelector.jsx'
import { IconBuilding, IconArrowLeft, IconSparkles, IconGlobe, IconActivity } from './Icons.jsx'
import './App.css'

function Login({ onBackToSignup, onLogin, onGoToOfficialLogin }) {
  const { login, googleLogin, preferredLanguage, setLanguage } = useAuth()
  const activeLanguage = preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forgot Password modal/view state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (isSubmitting) return
    setError('')

    const emailTrim = email.trim()
    if (!emailTrim) {
      setError(t.enterEmail || 'Please enter your email address.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrim)) {
      setError(t.enterValidEmail || 'Please enter a valid email address.')
      return
    }

    if (!password) {
      setError(t.enterPassword || 'Please enter your password.')
      return
    }

    setIsSubmitting(true)
    try {
      await login(emailTrim, password)
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
    if (isSubmitting) return
    setError('')
    setIsSubmitting(true)
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
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(formatAuthError(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault()
    setResetError('')

    const emailTrim = resetEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailTrim || !emailRegex.test(emailTrim)) {
      setResetError(t.enterValidEmail || 'Please enter a valid email address.')
      return
    }

    setIsResetting(true)
    try {
      await sendUserPasswordResetEmail(emailTrim)
      setResetSent(true)
    } catch (err) {
      console.error('[AUTH ERROR] Password reset error:', err)
      const code = err?.code || ''
      if (code === 'auth/invalid-email') {
        setResetError(t.enterValidEmail || 'Please enter a valid email address.')
      } else if (code === 'auth/user-not-found') {
        setResetError('Unable to send the reset email. Please check the email address and try again.')
      } else if (code === 'auth/network-request-failed') {
        setResetError('Something went wrong. Please check your connection and try again.')
      } else if (code === 'auth/too-many-requests') {
        setResetError('Too many attempts. Please try again in a few minutes.')
      } else {
        setResetError(formatAuthError(err) || 'Unable to send password reset email. Please try again.')
      }
    } finally {
      setIsResetting(false)
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
            <IconArrowLeft size={14} />
            <span>{t.home || 'Home'}</span>
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
            <IconBuilding size={14} />
            <span>Civic Technology Platform</span>
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
                <span className="feature-icon" aria-hidden="true">
                  <IconSparkles size={18} color="#0FA58F" />
                </span>
                <h3>{t.feature1Title || 'Gemini AI Priority Triage'}</h3>
              </div>
              <p>
                {t.feature1Desc || 'AI analyzes reported civic issues and helps prioritize them according to severity and urgency.'}
              </p>
            </div>

            {/* Feature 2: 8 Indian Languages + Dynamic Translation */}
            <div className="auth-feature-card">
              <div className="feature-card-header">
                <span className="feature-icon" aria-hidden="true">
                  <IconGlobe size={18} color="#0284c7" />
                </span>
                <h3>{t.feature2Title || '8 Indian Languages + Dynamic Translation'}</h3>
              </div>
              <p>
                {t.feature2Desc || 'Citizens can use the platform in supported Indian languages, while complaint descriptions can be dynamically translated for government teams.'}
              </p>
            </div>

            {/* Feature 3: Speech-to-Text & Audio Listeners */}
            <div className="auth-feature-card">
              <div className="feature-card-header">
                <span className="feature-icon" aria-hidden="true">
                  <IconActivity size={18} color="#0FA58F" />
                </span>
                <h3>{t.feature3Title || 'Speech-to-Text & Audio Listeners'}</h3>
              </div>
              <p>
                {t.feature3Desc || 'Citizens can report complaints using voice input and listen to complaint and status updates through audio playback.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Card (Login or Password Reset) */}
        <div className="auth-card-right">
          <div className="signup-card auth-card-transition">
            {showForgotPassword ? (
              /* ============================================== */
              /* FORGOT PASSWORD / PASSWORD RESET VIEW          */
              /* ============================================== */
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="auth-back-link"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setResetSent(false)
                      setResetError('')
                    }}
                  >
                    ← {t.backToSignIn || 'Back to Sign In'}
                  </button>
                </div>

                <h1>{t.resetYourPassword || 'Reset Your Password'}</h1>
                <p className="signup-description">
                  {t.resetPasswordDesc || "Enter the email address associated with your CivicPulse account and we'll send you a password reset link."}
                </p>

                {resetSent ? (
                  /* Password Reset Success Confirmation */
                  <div className="auth-success-box">
                    <div style={{ fontSize: '32px', marginBottom: '8px' }} aria-hidden="true">✉️</div>
                    <h3>
                      {t.passwordResetSent || 'Password reset email sent!'}
                    </h3>
                    <p>
                      {t.checkEmailInstructions || 'Check your email for instructions to create a new password.'}
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: '100%', marginTop: '8px' }}
                      onClick={() => {
                        setShowForgotPassword(false)
                        setResetSent(false)
                        setResetError('')
                      }}
                    >
                      {t.backToSignIn || 'Back to Sign In'}
                    </button>
                  </div>
                ) : (
                  /* Password Reset Form */
                  <form onSubmit={handlePasswordReset}>
                    {resetError && <p className="error-message main-error">{resetError}</p>}

                    <div className="form-group">
                      <label className="form-label">{t.emailAddress || 'Email Address'} *</label>
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        disabled={isResetting}
                        className="form-input"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="primary-button"
                      style={{ width: '100%', marginTop: '6px' }}
                    >
                      {isResetting
                        ? (t.sendingResetLink || 'Sending Link...')
                        : (t.sendResetLink || 'Send Reset Link')}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button
                        type="button"
                        className="auth-text-btn"
                        onClick={() => {
                          setShowForgotPassword(false)
                          setResetError('')
                        }}
                        disabled={isResetting}
                      >
                        {t.backToSignIn || 'Back to Sign In'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* ============================================== */
              /* STANDARD SIGN IN VIEW                          */
              /* ============================================== */
              <div>
                <h1>{t.welcomeBack || 'Welcome Back'}</h1>

                <p className="signup-description">
                  {t.loginSubtitle || 'Sign in to manage and track community issues.'}
                </p>

                {error && <p className="error-message main-error">{error}</p>}

                <form onSubmit={handleLogin} noValidate>
                  {/* Email Address */}
                  <div className="form-group">
                    <label className="form-label">{t.emailAddress || 'Email Address'}</label>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="form-input"
                    />
                  </div>

                  {/* Password with Visibility Toggle */}
                  <div className="form-group">
                    <label className="form-label">{t.password || 'Password'}</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isSubmitting}
                        className="form-input"
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? (t.hidePassword || 'Hide password') : (t.showPassword || 'Show password')}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Forgot Password Link directly below the password field, right-aligned */}
                    <div className="forgot-password-row">
                      <button
                        type="button"
                        className="forgot-password-btn"
                        onClick={() => {
                          setShowForgotPassword(true)
                          setResetError('')
                          setResetSent(false)
                          setResetEmail(email)
                        }}
                        disabled={isSubmitting}
                      >
                        {t.forgotPassword || 'Forgot Password?'}
                      </button>
                    </div>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="primary-button"
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    {isSubmitting ? (t.signingIn || 'Signing in...') : (t.signIn || 'Sign In')}
                  </button>

                  {/* Divider */}
                  <div className="divider">
                    <span>{t.or || 'OR'}</span>
                  </div>

                  {/* Google Sign-In Button */}
                  <button
                    type="button"
                    className="google-button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px', flexShrink: 0 }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{t.continueWithGoogle || 'Continue with Google'}</span>
                  </button>
                </form>

                {/* Sign Up Navigation */}
                <p className="login-text" style={{ marginTop: '20px' }}>
                  {t.dontHaveAccount || "Don't have an account?"}{' '}
                  <button type="button" onClick={onBackToSignup}>
                    {t.signUp || 'Sign Up'}
                  </button>
                </p>

                {/* Government Official Login Navigation */}
                <p className="login-text" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  {t.areYouOfficial || 'Are you a Government Official?'}{' '}
                  <button type="button" onClick={onGoToOfficialLogin}>
                    {t.officialPortalLogin || '→ Official Portal Login'}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login