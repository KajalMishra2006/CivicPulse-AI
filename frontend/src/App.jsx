import Dashboard from './Dashboard.jsx'
import Login from './login.jsx'
import { useState } from 'react'
import './App.css'

function App() {
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
  function handleGoogleSignIn() {
    console.log('Google sign-in clicked')
  }
  function handleSubmit(e) {
    e.preventDefault()

    let valid = true

    setNameError('')
    setEmailError('')
    setPasswordError('')
    setCountryError('')
    setStateError('')
    setLocalAreaError('')

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

    console.log('Form is valid!')
    console.log('Name:', name)
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('Country:', country)
    console.log('State:', state)
    console.log('Local Area:', localArea)
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
  const [showLogin, setShowLogin] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) {
    console.log('Dashboard state is TRUE')
    return <Dashboard onLogout={() => setShowDashboard(false)} />
  }

  if (showLogin) {
    return (
      <Login
        onBackToSignup={() => setShowLogin(false)}
        onLogin={() => setShowDashboard(true)}
      />
    )
  }
  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Join CivicPulse-AI</h1>

        <p className="signup-description">
          Report civic issues and help make your city better.
        </p>

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

          <button type="submit">
            Sign Up
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
      </div>
    </div>
  )
}

export default App