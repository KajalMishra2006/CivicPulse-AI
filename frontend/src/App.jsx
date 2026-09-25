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
import {
  getBricsCountries,
  getCountryLocationConfig,
  getLevel1Options,
  getLevel2Options,
  getLevel3Options
} from './utils/locations.js'
import { IconShield, IconBuilding } from './Icons.jsx'
import './App.css'

function App() {
  const { currentUser, userProfile, preferredLanguage, setLanguage, loading, register, googleLogin, logout } = useAuth()
  const activeLanguage = preferredLanguage || userProfile?.preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => Boolean(localStorage.getItem('civicpulse_language')))

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')

  // BRICS Country & Dynamic Hierarchical Location States
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [taluka, setTaluka] = useState('')
  const [localArea, setLocalArea] = useState('')

  const bricsCountries = useMemo(() => getBricsCountries(), [])
  const countryConfig = useMemo(() => getCountryLocationConfig(country), [country])

  const level1List = useMemo(() => {
    if (!country) return []
    return getLevel1Options(country)
  }, [country])

  const level2List = useMemo(() => {
    if (!country || !state) return []
    return getLevel2Options(country, state)
  }, [country, state])

  const level3List = useMemo(() => {
    if (!country || !state || !district || !countryConfig.hasLevel3) return []
    return getLevel3Options(country, state, district)
  }, [country, state, district, countryConfig.hasLevel3])

  function handleCountryChange(newCountry) {
    setCountry(newCountry)
    setState('')
    setDistrict('')
    setTaluka('')
    setLocalArea('')
    setCountryError('')
    setStateError('')
    setDistrictError('')
    setTalukaError('')
    setLocalAreaError('')
  }

  function handleLevel1Change(newState) {
    setState(newState)
    setDistrict('')
    setTaluka('')
    setStateError('')
    setDistrictError('')
    setTalukaError('')
  }

  function handleLevel2Change(newDistrict) {
    setDistrict(newDistrict)
    setTaluka('')
    setDistrictError('')
    setTalukaError('')
  }

  // Citizen Identity Document Registration Fields
  const [idType, setIdType] = useState('Citizen Government ID')
  const [idNumber, setIdNumber] = useState('')
  const [idFile, setIdFile] = useState(null)
  const [idPreview, setIdPreview] = useState(null)

  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [mobileError, setMobileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [countryError, setCountryError] = useState('')
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
    setMobileError('')
    setPasswordError('')
    setConfirmPasswordError('')
    setCountryError('')
    setStateError('')
    setDistrictError('')
    setTalukaError('')
    setLocalAreaError('')
    setIdError('')
    setAuthError('')

    let valid = true

    if (name.trim() === '') {
      setNameError(t.fullNamePlaceholder ? `${t.fullNamePlaceholder} is required` : 'Please enter your full name')
      valid = false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setEmailError(t.enterEmail || 'Please enter a valid email address')
      valid = false
    }

    if (!mobileNumber || mobileNumber.trim() === '') {
      setMobileError(t.mobileRequired || 'Mobile number is required.')
      valid = false
    }

    if (password.length < 8) {
      setPasswordError(t.enterPassword || 'Password must be at least 8 characters')
      valid = false
    }

    if (!confirmPassword) {
      setConfirmPasswordError(t.confirmPasswordPlaceholder || 'Please confirm your password')
      valid = false
    } else if (confirmPassword !== password) {
      setConfirmPasswordError(t.passwordsDoNotMatch || 'Passwords do not match')
      valid = false
    }

    if (!country) {
      setCountryError(t.selectCountry || 'Please select your country')
      valid = false
    }

    if (!state) {
      const cleanL1 = (countryConfig.level1Label || 'Region').replace('*', '').trim()
      setStateError(`${cleanL1} is required`)
      valid = false
    }

    if (!district) {
      const cleanL2 = (countryConfig.level2Label || 'Area / City').replace('*', '').trim()
      setDistrictError(`${cleanL2} is required`)
      valid = false
    }

    if (countryConfig.hasLevel3 && !taluka) {
      const cleanL3 = (countryConfig.level3Label || 'District / Taluka').replace('*', '').trim()
      setTalukaError(`${cleanL3} is required`)
      valid = false
    }

    if (localArea.trim() === '') {
      const cleanLocal = (countryConfig.localAreaLabel || 'Local Area').replace('*', '').trim()
      setLocalAreaError(`${cleanLocal} is required`)
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
        mobileNumber: mobileNumber.trim(),
        country,
        state,
        district,
        taluka: taluka || '',
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
        onLogin={() => setShowLogin(false)}
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
        {/* Clean Single-Row Header: Complete GovBridge Logo (Left) & Preferred Language (Right) */}
        <div className="signup-header header">
          <div className="brand-logo signup-brand-logo">
            <img
              src="/govbridge-logo.png"
              alt="GovBridge - Bridging Voices. Driving Action."
              className="govbridge-logo-img signup-header-logo"
            />
          </div>
          <div className="language-selector signup-language-selector">
            <LanguageSelector
              currentLanguage={activeLanguage}
              onSelectLanguage={setLanguage}
              variant="dark"
              label={t.preferredLanguage || 'Preferred Language'}
            />
          </div>
        </div>

        {/* Subtle Horizontal Divider Line */}
        <div className="signup-header-divider" />

        {/* Centered Create Account Section */}
        <div className="signup-heading-section">
          <h1>{t.createAccount || 'Create Account'}</h1>
          <p className="signup-description">
            {t.signupSubtitle || 'Create your GovBridge account to report and track civic issues.'}
          </p>
        </div>

        {authError && <p className="error-message main-error">{authError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          {/* FULL NAME */}
          <div className="location-field">
            <label>{t.fullName || 'Full Name'} *</label>
            <input
              type="text"
              placeholder={t.fullNamePlaceholder || 'Enter your full name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            {nameError && <p className="error-message">{nameError}</p>}
          </div>

          {/* EMAIL & MOBILE (2 columns) */}
          <div className="form-row-2">
            <div className="location-field">
              <label>{t.emailAddress || 'Email Address'} *</label>
              <input
                type="email"
                placeholder={t.emailPlaceholder || 'name@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              {emailError && <p className="error-message">{emailError}</p>}
            </div>

            <div className="location-field">
              <label>{t.mobileNumber || 'Mobile Number *'}</label>
              <input
                type="tel"
                placeholder={t.mobilePlaceholder || 'Enter your mobile number'}
                value={mobileNumber}
                onChange={(e) => {
                  setMobileNumber(e.target.value)
                  if (mobileError) setMobileError('')
                }}
                disabled={isSubmitting}
              />
              {mobileError && <p className="error-message">{mobileError}</p>}
            </div>
          </div>

          {/* PASSWORD */}
          <div className="location-field">
            <label>{t.password || 'Password'} *</label>
            <input
              type="password"
              placeholder={t.passwordPlaceholder || 'Create a password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
            {passwordError && <p className="error-message">{passwordError}</p>}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="location-field">
            <label>{t.confirmPassword || 'Confirm Password'} *</label>
            <input
              type="password"
              placeholder={t.confirmPasswordPlaceholder || 'Confirm your password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
            {confirmPasswordError && <p className="error-message">{confirmPasswordError}</p>}
          </div>

          {/* LOCATION JURISDICTION: COUNTRY & DYNAMIC ADMINISTRATIVE REGIONS */}
          <div className="location-section">
            {/* Country Selector */}
            <div className="location-field" style={{ marginBottom: country ? '14px' : '0' }}>
              <label>{t.country || 'Country'} *</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                disabled={isSubmitting}
                className="form-select"
              >
                <option value="">{t.selectCountry || 'Select your country'}</option>
                {bricsCountries.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              {countryError && <p className="error-message">{countryError}</p>}
            </div>

            {/* Dynamic Cascading Regions */}
            {country && (
              <>
                <div className="form-row-2">
                  {/* Level 1 Region */}
                  <div className="location-field">
                    <label>{countryConfig.level1Label}</label>
                    <select
                      value={state}
                      onChange={(e) => handleLevel1Change(e.target.value)}
                      disabled={isSubmitting || level1List.length === 0}
                      className="form-select"
                    >
                      <option value="">{countryConfig.level1Placeholder || 'Select...'}</option>
                      {level1List.map((r) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                    {stateError && <p className="error-message">{stateError}</p>}
                  </div>

                  {/* Level 2 Region */}
                  <div className="location-field">
                    <label>{countryConfig.level2Label}</label>
                    <select
                      value={district}
                      onChange={(e) => handleLevel2Change(e.target.value)}
                      disabled={isSubmitting || !state || level2List.length === 0}
                      className="form-select"
                    >
                      <option value="">{countryConfig.level2Placeholder || 'Select...'}</option>
                      {level2List.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    {districtError && <p className="error-message">{districtError}</p>}
                  </div>
                </div>

                {countryConfig.hasLevel3 ? (
                  <div className="form-row-2">
                    {/* Level 3 Region */}
                    <div className="location-field">
                      <label>{countryConfig.level3Label}</label>
                      <select
                        value={taluka}
                        onChange={(e) => {
                          setTaluka(e.target.value)
                          setTalukaError('')
                        }}
                        disabled={isSubmitting || !district || level3List.length === 0}
                        className="form-select"
                      >
                        <option value="">{countryConfig.level3Placeholder || 'Select...'}</option>
                        {level3List.map((tlk) => (
                          <option key={tlk.id} value={tlk.name}>{tlk.name}</option>
                        ))}
                      </select>
                      {talukaError && <p className="error-message">{talukaError}</p>}
                    </div>

                    {/* Local Area */}
                    <div className="location-field">
                      <label>{countryConfig.localAreaLabel}</label>
                      <input
                        type="text"
                        placeholder={countryConfig.localAreaPlaceholder}
                        value={localArea}
                        onChange={(e) => {
                          setLocalArea(e.target.value)
                          setLocalAreaError('')
                        }}
                        disabled={isSubmitting}
                      />
                      {localAreaError && <p className="error-message">{localAreaError}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="location-field" style={{ marginTop: '12px' }}>
                    <label>{countryConfig.localAreaLabel}</label>
                    <input
                      type="text"
                      placeholder={countryConfig.localAreaPlaceholder}
                      value={localArea}
                      onChange={(e) => {
                        setLocalArea(e.target.value)
                        setLocalAreaError('')
                      }}
                      disabled={isSubmitting}
                    />
                    {localAreaError && <p className="error-message">{localAreaError}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CITIZEN IDENTITY VERIFICATION SECTION */}
          <div className="citizen-verification-card">
            <label className="verification-card-title">
              <IconShield size={18} color="#0FA58F" />
              <span>{t.citizenIdentityVerification || 'Citizen Identity Verification Document'}</span>
            </label>
            <p className="verification-card-subtitle">
              {t.citizenVerificationDesc || "New accounts start as Pending Verification and are validated by your local administrative area's Citizen Access Employee."}
            </p>

            <div className="form-row-2 verification-fields-row">
              <div className="location-field">
                <label>{t.documentType || 'Document Type'}</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  disabled={isSubmitting}
                  className="form-select"
                >
                  <option value="Citizen Government ID">Government ID Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div className="location-field">
                <label>{t.idNumberOptional || 'ID Number (Optional)'}</label>
                <input
                  type="text"
                  placeholder={t.idNumberPlaceholder || 'e.g. DL-1420110012345'}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="file-upload-wrapper">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleIdFileChange}
                disabled={isSubmitting}
                className="form-file-input"
              />
            </div>

            {idPreview && (
              <div className="id-preview-container">
                <img src={idPreview} alt="Citizen ID Preview" className="id-preview-image" />
                <button type="button" className="remove-image-btn" onClick={handleRemoveIdFile}>✕ Remove</button>
              </div>
            )}

            {idFile && !idPreview && (
              <div className="id-file-badge">
                <span>📄 {idFile.name}</span>
                <button type="button" className="remove-image-btn" onClick={handleRemoveIdFile}>✕ Remove</button>
              </div>
            )}

            {idError && <p className="error-message">{idError}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="signup-submit-button primary-button"
          >
            {isSubmitting ? (t.creatingAccount || 'Creating Account...') : (t.createAccount || 'Create Account')}
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
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>{t.continueWithGoogle || 'Continue with Google'}</span>
        </button>

        <p className="login-text">
          {t.alreadyHaveAccount || 'Already have an account?'}{' '}
          <button type="button" onClick={() => setShowLogin(true)}>
            {t.signIn || 'Sign In'}
          </button>
        </p>

        <div className="official-link-section">
          <p className="official-link-text">
            {t.areYouOfficial || 'Are you a Government Official?'}
          </p>
          <button
            type="button"
            className="official-login-btn"
            onClick={() => setShowOfficialLogin(true)}
          >
            <IconBuilding size={16} />
            <span>{t.officialSignInBtn || 'Official Sign In →'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App