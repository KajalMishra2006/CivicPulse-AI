import LanguageSelector from './LanguageSelector.jsx'
import { IconBuilding, IconArrowRight, IconUsers, IconBrain, IconLeaf } from './Icons.jsx'
import './App.css'

function WelcomePage({ onGetStarted, onGoToLogin, activeLanguage, setLanguage, t }) {
  return (
    <div className="govbridge-welcome-page">
      {/* Top Navigation Bar */}
      <header className="govbridge-welcome-nav">
        <div className="govbridge-welcome-brand">
          <img
            src="/govbridge-logo.png"
            alt="GovBridge"
            className="govbridge-welcome-logo"
          />
        </div>

        <div className="govbridge-welcome-nav-actions">
          <span className="govbridge-welcome-tagline-text">
            Better Governance | Stronger Communities
          </span>

          <div className="govbridge-welcome-lang">
            <LanguageSelector
              currentLanguage={activeLanguage}
              onSelectLanguage={setLanguage}
              variant="dark"
            />
          </div>

          <button
            type="button"
            className="govbridge-nav-signin-btn"
            onClick={onGoToLogin}
          >
            {t.signIn || 'Sign In'}
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="govbridge-welcome-main">
        <div className="govbridge-welcome-hero-content">
          <h1 className="govbridge-welcome-title">
            Bridging Citizens and Government
          </h1>

          <p className="govbridge-welcome-subtitle">
            Your voice. Smarter governance. Better communities.
          </p>

          <p className="govbridge-welcome-support-text">
            Report civic issues, connect with the right authorities, and track progress — all in one place.
          </p>

          <div className="govbridge-welcome-cta-wrap">
            <button
              type="button"
              className="govbridge-primary-cta"
              onClick={onGetStarted}
            >
              <span>Get Started</span>
              <IconArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* 4 Feature Highlights / Pillars */}
        <section className="govbridge-welcome-pillars-grid" aria-label="GovBridge Key Pillars">
          <div className="govbridge-pillar-card">
            <div className="govbridge-pillar-icon citizen">
              <IconUsers size={22} color="#0FA58F" />
            </div>
            <div className="govbridge-pillar-info">
              <h3 className="govbridge-pillar-title">Citizen First</h3>
              <p className="govbridge-pillar-desc">Your voice matters</p>
            </div>
          </div>

          <div className="govbridge-pillar-card">
            <div className="govbridge-pillar-icon ai">
              <IconBrain size={22} color="#0FA58F" />
            </div>
            <div className="govbridge-pillar-info">
              <h3 className="govbridge-pillar-title">AI Powered</h3>
              <p className="govbridge-pillar-desc">Smarter solutions</p>
            </div>
          </div>

          <div className="govbridge-pillar-card">
            <div className="govbridge-pillar-icon transparent">
              <IconBuilding size={22} color="#0FA58F" />
            </div>
            <div className="govbridge-pillar-info">
              <h3 className="govbridge-pillar-title">Transparent</h3>
              <p className="govbridge-pillar-desc">Accountable governance</p>
            </div>
          </div>

          <div className="govbridge-pillar-card">
            <div className="govbridge-pillar-icon sustainable">
              <IconLeaf size={22} color="#0FA58F" />
            </div>
            <div className="govbridge-pillar-info">
              <h3 className="govbridge-pillar-title">Sustainable</h3>
              <p className="govbridge-pillar-desc">For a better tomorrow</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default WelcomePage
