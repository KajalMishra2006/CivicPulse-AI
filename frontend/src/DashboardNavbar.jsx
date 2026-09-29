import { IconBuilding, IconHome, IconUser, IconLogOut } from './Icons.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import './App.css'

export default function DashboardNavbar({
  activeRole = 'citizen', // 'citizen' | 'official'
  locationText = '',
  userName = '',
  onLogout,
  onBrandClick,
  showLanguageSelector = false,
  currentLanguage = 'English',
  onSelectLanguage
}) {
  return (
    <nav className="govbridge-dashboard-navbar">
      {/* 1. BRAND SECTION (LEFT) */}
      <div className="navbar-brand-section">
        <div
          className="govbridge-nav-brand"
          onClick={onBrandClick}
          title="GovBridge Home"
          style={{ cursor: onBrandClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '2px' }}
        >
          <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          <span className="govbridge-nav-tagline">Bridging Voices. Driving Action.</span>
        </div>
      </div>

      {/* 2. ROLE INDICATOR PILLS (CENTER) */}
      <div className="navbar-center-roles">
        <div className="govbridge-role-pills">
          <div className={`govbridge-role-pill ${activeRole === 'citizen' ? 'active' : 'inactive'}`}>
            <IconHome size={15} />
            <span>Citizen</span>
          </div>

          <div className={`govbridge-role-pill ${activeRole === 'official' ? 'active' : 'inactive'}`}>
            <IconBuilding size={15} />
            <span>Government Official</span>
          </div>
        </div>
      </div>

      {/* 3. USER ACTIONS & IDENTITY (RIGHT) */}
      <div className="navbar-right-actions">
        {locationText && (
          <div className="navbar-location-pill" title="Administrative Jurisdiction">
            <span>📍 {locationText}</span>
          </div>
        )}

        {showLanguageSelector && onSelectLanguage && (
          <div className="navbar-lang-wrapper">
            <LanguageSelector
              currentLanguage={currentLanguage}
              onSelectLanguage={onSelectLanguage}
              variant="dark"
            />
          </div>
        )}

        <div className="navbar-user-chip">
          <div className="navbar-user-avatar">
            <IconUser size={15} color="#0FA58F" />
          </div>
          <span className="navbar-user-name" title={userName}>
            {userName || 'User'}
          </span>
        </div>

        {onLogout && (
          <button
            type="button"
            className="navbar-logout-button"
            onClick={onLogout}
            title="Sign out of GovBridge"
          >
            <IconLogOut size={14} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </nav>
  )
}
