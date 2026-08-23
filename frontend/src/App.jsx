import Dashboard from './Dashboard.jsx'
import GovernmentDashboard from './GovernmentDashboard.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import Login from './login.jsx'
import OfficialLogin from './OfficialLogin.jsx'
import OfficialVerificationRequest from './OfficialVerificationRequest.jsx'
import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import './App.css'

function App() {
  const { currentUser, userProfile, loading, register, googleLogin, logout } = useAuth()

  console.log('[APP AUTH]', {
    uid: currentUser?.uid,
    email: currentUser?.email,
    role: userProfile?.role,
    verified: userProfile?.verified,
    userProfile
  })

  const countries = [
    'Brazil',
    'Russia',
    'India',
    'China',
    'South Africa',
    'Egypt',
    'Ethiopia',
    'Iran',
    'United Arab Emirates',
    'Indonesia',
    'Saudi Arabia'
  ]
  const states = {
    India: [
      'Maharashtra',
      'Gujarat',
      'Karnataka',
      'Tamil Nadu',
      'Kerala'
    ],

    Brazil: [
      'São Paulo',
      'Rio de Janeiro',
      'Minas Gerais',
      'Bahia',
      'Paraná'
    ],

    Russia: [
      'Moscow',
      'Saint Petersburg',
      'Novosibirsk Oblast',
      'Sverdlovsk Oblast',
      'Krasnodar Krai'
    ],

    China: [
      'Guangdong',
      'Jiangsu',
      'Zhejiang',
      'Sichuan',
      'Shandong'
    ],

    'South Africa': [
      'Gauteng',
      'Western Cape',
      'KwaZulu-Natal',
      'Eastern Cape',
      'Limpopo'
    ],

    Egypt: [
      'Cairo',
      'Giza',
      'Alexandria',
      'Qalyubia',
      'Dakahlia'
    ],

    Ethiopia: [
      'Oromia',
      'Amhara',
      'Tigray',
      'Somali',
      'Afar'
    ],

    Iran: [
      'Tehran',
      'Isfahan',
      'Fars',
      'Razavi Khorasan',
      'East Azerbaijan'
    ],

    'United Arab Emirates': [
      'Abu Dhabi',
      'Dubai',
      'Sharjah',
      'Ajman',
      'Fujairah'
    ],

    Indonesia: [
      'West Java',
      'East Java',
      'Central Java',
      'North Sumatra',
      'Bali'
    ],

    'Saudi Arabia': [
      'Riyadh',
      'Makkah',
      'Madinah',
      'Eastern Province',
      'Asir'
    ]
  }

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [localArea, setLocalArea] = useState('')
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [countryError, setCountryError] = useState('')
  const [stateError, setStateError] = useState('')
  const [localAreaError, setLocalAreaError] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showOfficialLogin, setShowOfficialLogin] = useState(false)
  const [showVerificationRequest, setShowVerificationRequest] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationName, setVerificationName] = useState('')

  async function handleGoogleSignIn() {
    setAuthError('')
    try {
      await googleLogin()
    } catch (err) {
      console.error('Google Sign In Error:', err)
      setAuthError(formatAuthError(err))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    let valid = true

    setNameError('')
    setEmailError('')
    setPasswordError('')
    setCountryError('')
    setStateError('')
    setLocalAreaError('')
    setAuthError('')

    if (name.trim() === '') {
      setNameError('Please enter your full name')
      valid = false
    }

    if (email.trim() === '') {
      setEmailError('Please enter your email')
      valid = false
    } else if (!email.includes('@')) {
      setEmailError('Please enter a valid email')
      valid = false
    }

    if (password.trim() === '') {
      setPasswordError('Please enter a password')
      valid = false
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      valid = false
    }

    if (country === '') {
      setCountryError('Please select your country')
      valid = false
    }

    if (state === '') {
      setStateError('Please select your state')
      valid = false
    }

    if (localArea.trim() === '') {
      setLocalAreaError('Please enter your local area')
      valid = false
    }

    if (!valid) {
      return
    }

    setIsSubmitting(true)
    try {
      await register(name, email, password, country, state, localArea)
    } catch (err) {
      console.error('Signup Error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setEmailError('This email is already registered. Please login.')
      } else if (err.code === 'auth/weak-password') {
        setPasswordError('Password is too weak. Must be at least 8 characters.')
      } else {
        setAuthError(formatAuthError(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // If user is authenticated, display the Dashboard based on role
  if (currentUser) {
    // If profile is still in flight, wait for AuthContext before making routing decision
    if (loading || userProfile === null) {
      return (
        <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Loading account session...</p>
        </div>
      )
    }

    if (userProfile?.role === 'admin' && userProfile?.verified === true) {
      console.log('[APP ROUTING] Admin Dashboard')
      return <AdminDashboard onLogout={logout} />
    }

    if (userProfile?.role === 'official' && userProfile?.verified === true) {
      console.log('[APP ROUTING] Government Dashboard')
      return <GovernmentDashboard onLogout={logout} />
    }

    console.log('[APP ROUTING] Citizen Dashboard')
    return <Dashboard onLogout={logout} />
  }

  // Dedicated Official Verification Request view
  if (showVerificationRequest) {
    return (
      <OfficialVerificationRequest
        initialEmail={verificationEmail}
        initialName={verificationName}
        onBackToOfficialLogin={() => {
          setShowVerificationRequest(false)
          setShowOfficialLogin(true)
        }}
      />
    )
  }

  // Dedicated Official Login view
  if (showOfficialLogin) {
    return (
      <OfficialLogin
        onBackToCitizenLogin={() => {
          setShowOfficialLogin(false)
          setShowLogin(true)
        }}
        onGoToVerificationRequest={(email, name) => {
          setVerificationEmail(email || '')
          setVerificationName(name || '')
          setShowVerificationRequest(true)
          setShowOfficialLogin(false)
        }}
      />
    )
  }

  // Citizen Login view
  if (showLogin) {
    return (
      <Login
        onBackToSignup={() => setShowLogin(false)}
        onLogin={() => {}}
        onGoToOfficialLogin={() => {
          setShowOfficialLogin(true)
          setShowLogin(false)
        }}
      />
    )
  }

  // Citizen Signup view
  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Join CivicPulse-AI</h1>

        <p className="signup-description">
          Report civic issues and help make your city better.
        </p>

        {authError && <p className="error-message main-error">{authError}</p>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {nameError && <p className="error-message">{nameError}</p>}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && <p className="error-message">{emailError}</p>}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError && (
            <p className="error-message">{passwordError}</p>
          )}

          <div className="location-field">
            <label>Country</label>

            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setState('')
              }}
            >
              <option value="">Select Country</option>
              {countries.map((countryName) => (
                <option key={countryName} value={countryName}>
                  {countryName}
                </option>
              ))}
            </select>
            {countryError && <p className="error-message">{countryError}</p>}
          </div>

          <div className="location-field">
            <label>State / Province</label>

            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={!country}
            >
              <option value="">Select State</option>

              {states[country]?.map((stateName) => (
                <option key={stateName} value={stateName}>
                  {stateName}
                </option>
              ))}
            </select>
            {stateError && <p className="error-message">{stateError}</p>}
          </div>
          <input
            type="text"
            placeholder="Enter your local area"
            value={localArea}
            onChange={(e) => setLocalArea(e.target.value)}
          />
          {localAreaError && <p className="error-message">{localAreaError}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account...' : 'Sign Up'}
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
          Already have an account?{' '}
          <button type="button" onClick={() => setShowLogin(true)}>
            Login
          </button>
        </p>

        <p className="login-text" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          Are you a Government Official?{' '}
          <button type="button" onClick={() => { setShowOfficialLogin(true); setShowLogin(false); }}>
            → Official Portal Login
          </button>
        </p>
      </div>
    </div>
  )
}

export default App