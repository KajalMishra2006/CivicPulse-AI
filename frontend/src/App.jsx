import Dashboard from './Dashboard.jsx'
import GovernmentDashboard from './GovernmentDashboard.jsx'
import SuperAdminDashboard from './SuperAdminDashboard.jsx'
import StateAdminDashboard from './StateAdminDashboard.jsx'
import DistrictAdminDashboard from './DistrictAdminDashboard.jsx'
import CitizenAccessOfficerDashboard from './CitizenAccessOfficerDashboard.jsx'
import Login from './login.jsx'
import OfficialLogin from './OfficialLogin.jsx'
import OfficialVerificationRequest from './OfficialVerificationRequest.jsx'
import LanguageOnboardingModal from './LanguageOnboardingModal.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import { useState, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { formatAuthError } from './firebase/auth.js'
import { getTranslation } from './utils/translations.js'
import { getAllStates, getDistrictsForState, getTalukasForDistrict } from './utils/locations.js'
import './App.css'

function App() {
  const { currentUser, userProfile, preferredLanguage, setLanguage, loading, register, googleLogin, logout } = useAuth()
  const activeLanguage = preferredLanguage || userProfile?.preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => Boolean(localStorage.getItem('civicpulse_language')))

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const country = 'India'

  const allStates = getAllStates()
  const [state, setState] = useState(allStates[0]?.name || 'Maharashtra')

  const districtList = useMemo(() => {
    return getDistrictsForState(state)
  }, [state])

  const [district, setDistrict] = useState('Pune')

  const talukaList = useMemo(() => {
    return getTalukasForDistrict(state, district)
  }, [state, district])

  const [taluka, setTaluka] = useState('Haveli')

  const [localArea, setLocalArea] = useState('')

  // Citizen Identity Document Registration Fields
  const [idType, setIdType] = useState('Citizen Government ID')
  const [idNumber, setIdNumber] = useState('')
  const [idFile, setIdFile] = useState(null)
  const [idPreview, setIdPreview] = useState(null)

  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [stateError, setStateError] = useState('')
  const [districtError, setDistrictError] = useState('')
  const [talukaError, setTalukaError] = useState('')
  const [localAreaError, setLocalAreaError] = useState('')
  const [idError, setIdError] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Navigation states for unauthenticated flows
  const [showLogin, setShowLogin] = useState(false)
  const [showOfficialLogin, setShowOfficialLogin] = useState(false)
  const [showVerificationRequest, setShowVerificationRequest] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationName, setVerificationName] = useState('')

  function handleIdFileChange(e) {
    setIdError('')
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setIdError('Please upload an image (JPG, PNG, WebP) or PDF file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setIdError('File size exceeds 5MB limit.')
      return
    }

    setIdFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setIdPreview(url)
    } else {
      setIdPreview(null)
    }
  }

  function handleRemoveIdFile() {
    setIdFile(null)
    if (idPreview) {
      URL.revokeObjectURL(idPreview)
      setIdPreview(null)
    }
  }

  async function handleGoogleSignIn() {
    setAuthError('')
    try {
      await googleLogin()
    } catch (err) {
      console.error('Google Sign-in Error:', err)
      setAuthError(formatAuthError(err))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    setNameError('')
    setEmailError('')
    setPasswordError('')
    setStateError('')
    setDistrictError('')
    setTalukaError('')
    setLocalAreaError('')
    setIdError('')
    setAuthError('')

    let valid = true

    if (name.trim() === '') {
      setNameError(t.fullNamePlaceholder ? `${t.fullNamePlaceholder} is required` : 'Please enter your name')
      valid = false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setEmailError(t.enterEmail || 'Please enter a valid email address')
      valid = false
    }

    if (password.length < 8) {
      setPasswordError(t.enterPassword || 'Password must be at least 8 characters')
      valid = false
    }

    if (!state) {
      setStateError(t.selectState || 'Please select your state')
      valid = false
    }

    if (!district) {
      setDistrictError('Please select your district')
      valid = false
    }

    if (!taluka) {
      setTalukaError('Please select your taluka / ward')
      valid = false
    }

    if (localArea.trim() === '') {
      setLocalAreaError(t.enterLocalArea || 'Please enter your local area / ward')
      valid = false
    }

    if (!valid) {
      return
    }

    setIsSubmitting(true)
    try {
      let idDocumentUrl = null
      if (idFile) {
        idDocumentUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (re) => resolve(re.target.result)
          reader.readAsDataURL(idFile)
        })
      }

      await register({
        name,
        email,
        password,
        mobileNumber,
        country,
        state,
        district,
        taluka,
        localArea,
        idType,
        idNumber: idNumber.trim(),
        idDocumentUrl
      })
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

  // If user is authenticated, route to the corresponding hierarchical dashboard
  if (currentUser) {
    if (loading) {
      return (
        <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>{t.loading || 'Loading account session...'}</p>
        </div>
      )
    }

    if (userProfile === null) {
      return (
        <div className="signup-page">
          <div className="signup-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ fontSize: '42px', marginBottom: '10px' }}>⚠️</div>
            <h2>Account Profile Initialization</h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
              We could not load a profile document for <strong>{currentUser.email}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => window.location.reload()}
              >
                🔄 Retry
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ flex: 1, marginTop: 0 }}
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )
    }

    const isVerifiedOfficialUser = userProfile?.verified === true || userProfile?.accountStatus === 'approved' || userProfile?.accountStatus === 'active'

    // 1. Super Admin Portal (Apex National Oversight)
    if ((userProfile?.role === 'super_admin' || userProfile?.role === 'admin') && isVerifiedOfficialUser) {
      return <SuperAdminDashboard onLogout={logout} />
    }

    // 2. State Admin Portal (Statewide Oversight)
    if (userProfile?.role === 'state_admin' && isVerifiedOfficialUser) {
      return <StateAdminDashboard onLogout={logout} />
    }

    // 3. District Admin Portal (District-wide Operations)
    if (userProfile?.role === 'district_admin' && isVerifiedOfficialUser) {
      return <DistrictAdminDashboard onLogout={logout} />
    }

    // 4. Taluka Citizen Access Employee (Taluka Citizen Gate)
    if ((userProfile?.role === 'citizen_access_employee' || userProfile?.role === 'citizen_access_officer') && isVerifiedOfficialUser) {
      return <CitizenAccessOfficerDashboard onLogout={logout} />
    }

    // 5. Taluka Issue Resolution Employee (Taluka Field Ops)
    if ((userProfile?.role === 'issue_resolution_employee' || userProfile?.role === 'issue_resolution_officer' || userProfile?.role === 'official') && isVerifiedOfficialUser) {
      return <GovernmentDashboard onLogout={logout} />
    }

    // 6. Government Employee / Admin Applicant (Pending Verification Screen)
    if (userProfile?.role === 'applicant' || (!isVerifiedOfficialUser && userProfile?.employeeType)) {
      const roleLabel = (userProfile?.requestedRole || userProfile?.employeeType || 'Government Employee')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      return (
        <div className="signup-page">
          <div className="signup-card" style={{ maxWidth: '540px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏛️</div>
            <h2>Official Account Pending Review</h2>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
              Your application for <strong>{roleLabel}</strong> is currently being reviewed by your supervising Administrator.
            </p>

            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', margin: '16px 0', textAlign: 'left', fontSize: '13px', color: '#334155' }}>
              <p style={{ margin: '0 0 6px 0' }}><strong>Official Name:</strong> {userProfile?.name}</p>
              <p style={{ margin: '0 0 6px 0' }}><strong>Official Email:</strong> {userProfile?.email}</p>
              {userProfile?.employeeId && (
                <p style={{ margin: '0 0 6px 0' }}><strong>Employee ID:</strong> {userProfile?.employeeId} ({userProfile?.department})</p>
              )}
              <p style={{ margin: '0 0 6px 0' }}><strong>Jurisdiction:</strong> {userProfile?.talukaName || userProfile?.taluka}, {userProfile?.districtName || userProfile?.district}, {userProfile?.stateName || userProfile?.state}</p>
              <p style={{ margin: 0, color: '#d97706', fontWeight: '700' }}>⏳ Status: PENDING ADMINISTRATIVE REVIEW</p>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Once your credentials and departmental ID are validated, signing in will grant direct access to your regional command dashboard.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => window.location.reload()}
              >
                🔄 Refresh Status
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ flex: 1, marginTop: 0 }}
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )
    }

    // 7. Citizen Language Onboarding Modal
    if (!hasCompletedOnboarding && !userProfile?.preferredLanguage) {
      return (
        <LanguageOnboardingModal
          currentLanguage={activeLanguage}
          onSelectLanguage={(lang) => {
            setLanguage(lang)
            setHasCompletedOnboarding(true)
          }}
        />
      )
    }

    // 8. Citizen Dashboard
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

  // Dedicated Government Official Login view
  if (showOfficialLogin) {
    return (
      <OfficialLogin
        onBackToCitizenLogin={() => setShowOfficialLogin(false)}
        onGoToVerificationRequest={(emailVal, nameVal) => {
          setVerificationEmail(emailVal || '')
          setVerificationName(nameVal || '')
          setShowOfficialLogin(false)
          setShowVerificationRequest(true)
        }}
      />
    )
  }

  // Dedicated Citizen Login view
  if (showLogin) {
    return (
      <Login
        onBackToSignup={() => setShowLogin(false)}
        onGoToOfficialLogin={() => {
          setShowLogin(false)
          setShowOfficialLogin(true)
        }}
      />
    )
  }

  // Default: Multilingual Citizen Registration & Sign-Up View
  return (
    <div className="signup-page">
      <div className="signup-card">
        {/* Language Selection Header Area */}
        <div className="signup-language-bar">
          <LanguageSelector
            currentLanguage={activeLanguage}
            onSelectLanguage={setLanguage}
            variant="light"
            label={t.preferredLanguage || 'Language'}
          />
        </div>

        <h1>{t.createAccount || 'Create Your Account'}</h1>
        <p className="signup-description">
          {t.signupSubtitle || 'Join CivicPulse-AI to report community issues and track municipal progress.'}
        </p>

        {authError && <p className="error-message main-error">{authError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          {/* FULL NAME */}
          <div className="location-field">
            <label>{t.fullName || 'Full Name'} *</label>
            <input
              type="text"
              placeholder={t.fullNamePlaceholder || 'e.g. Rajesh Sharma'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            {nameError && <p className="error-message">{nameError}</p>}
          </div>

          {/* EMAIL & MOBILE */}
          <div className="form-row-2">
            <div className="location-field">
              <label>{t.emailAddress || 'Email Address'} *</label>
              <input
                type="email"
                placeholder={t.emailPlaceholder || 'e.g. rajesh@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              {emailError && <p className="error-message">{emailError}</p>}
            </div>

            <div className="location-field">
              <label>Mobile Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="location-field">
            <label>{t.password || 'Password'} *</label>
            <input
              type="password"
              placeholder={t.passwordPlaceholder || 'Minimum 8 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
            {passwordError && <p className="error-message">{passwordError}</p>}
          </div>

          {/* LOCATION JURISDICTION: STATE, DISTRICT, TALUKA, WARD */}
          <div className="location-section">
            <div className="location-field">
              <label>{t.state || 'State'} *</label>
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value)
                  const dists = getDistrictsForState(e.target.value)
                  const firstDist = dists[0]?.name || 'Pune'
                  setDistrict(firstDist)
                  const talukas = getTalukasForDistrict(e.target.value, firstDist)
                  setTaluka(talukas[0]?.name || 'Haveli')
                }}
                disabled={isSubmitting}
                className="form-select"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                {allStates.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {stateError && <p className="error-message">{stateError}</p>}
            </div>

            <div className="location-field">
              <label>District *</label>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value)
                  const talukas = getTalukasForDistrict(state, e.target.value)
                  setTaluka(talukas[0]?.name || 'Haveli')
                }}
                disabled={isSubmitting}
                className="form-select"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                {districtList.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              {districtError && <p className="error-message">{districtError}</p>}
            </div>

            <div className="location-field">
              <label>Taluka / Ward *</label>
              <select
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
                disabled={isSubmitting}
                className="form-select"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                {talukaList.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              {talukaError && <p className="error-message">{talukaError}</p>}
            </div>

            <div className="location-field">
              <label>{t.localArea || 'Local Area / Ward'} *</label>
              <input
                type="text"
                placeholder={t.enterLocalArea || 'Neighborhood / Ward'}
                value={localArea}
                onChange={(e) => setLocalArea(e.target.value)}
                disabled={isSubmitting}
              />
              {localAreaError && <p className="error-message">{localAreaError}</p>}
            </div>
          </div>

          {/* CITIZEN IDENTITY VERIFICATION SECTION */}
          <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <label style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛡️</span> Citizen Identity Verification Document
            </label>
            <p style={{ margin: '4px 0 10px 0', fontSize: '12px', color: '#64748b' }}>
              New accounts start as <strong>Pending Verification</strong> and are validated by your taluka's Citizen Access Employee.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Document Type</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  disabled={isSubmitting}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                >
                  <option value="Citizen Government ID">Government ID Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>ID Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DL-1420110012345"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleIdFileChange}
              disabled={isSubmitting}
              className="form-file-input"
            />

            {idPreview && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={idPreview} alt="Citizen ID Preview" style={{ maxHeight: '70px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="button" className="remove-image-btn" onClick={handleRemoveIdFile}>✕ Remove</button>
              </div>
            )}

            {idFile && !idPreview && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#0369a1' }}>
                📄 {idFile.name} <button type="button" className="remove-image-btn" onClick={handleRemoveIdFile}>✕ Remove</button>
              </div>
            )}

            {idError && <p className="error-message">{idError}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} style={{ marginTop: '16px' }}>
            {isSubmitting ? (t.creatingAccount || 'Submitting Registration...') : (t.createAccount || 'Register Citizen Account')}
          </button>
        </form>

        <div className="divider">
          <span>{t.or || 'OR'}</span>
        </div>

        <button
          type="button"
          className="google-button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <span className="google-icon">G</span>
          {t.signUpWithGoogle || 'Sign up with Google'}
        </button>

        <p className="login-text">
          {t.alreadyHaveAccount || 'Already have an account?'}
          <button type="button" onClick={() => setShowLogin(true)}>
            {t.signIn || 'Sign In'}
          </button>
        </p>

        <div className="official-link-section">
          <p className="official-link-text">
            {t.areYouOfficial || 'Are you a government official or municipal officer?'}
          </p>
          <button
            type="button"
            className="official-login-btn"
            onClick={() => setShowOfficialLogin(true)}
          >
            🏛️ {t.officialSignInBtn || 'Government Official Sign In / Request Access'} →
          </button>
        </div>
      </div>
    </div>
  )
}

export default App