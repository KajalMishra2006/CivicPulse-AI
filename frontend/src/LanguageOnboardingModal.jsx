import { SUPPORTED_LANGUAGES } from './utils/speech.js'
import { getTranslation } from './utils/translations.js'
import './App.css'

function LanguageOnboardingModal({ currentLanguage, onSelectLanguage, onClose, isOptional = false }) {
  const t = getTranslation(currentLanguage || 'English')

  function handleSelect(langName) {
    onSelectLanguage(langName)
    localStorage.setItem('civicpulse_language_selected', 'true')
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="gov-modal-backdrop" style={{ zIndex: 1000, background: 'rgba(7, 26, 43, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="gov-modal-card" style={{ maxWidth: '640px', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        {isOptional && onClose && (
          <button
            type="button"
            className="gov-modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        )}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🌐</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a' }}>
            {t.chooseLanguage}
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            अपनी पसंदीदा भाषा चुनें • तुमची भाषा निवडा • உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்
          </p>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
            {t.chooseLanguageSub}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            marginBottom: '24px'
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLanguage?.toLowerCase() === lang.name.toLowerCase()
            return (
              <button
                key={lang.name}
                type="button"
                onClick={() => handleSelect(lang.name)}
                style={{
                  padding: '16px 12px',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  background: isSelected ? '#f0f9ff' : '#ffffff',
                  color: isSelected ? '#0369a1' : '#1e293b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                }}
              >
                <span style={{ fontSize: '22px' }}>{lang.flag}</span>
                <span style={{ fontSize: '15px', fontWeight: '700' }}>{lang.nativeName}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{lang.name}</span>
              </button>
            )
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="primary-button"
            style={{ minWidth: '180px', margin: '0 auto' }}
            onClick={() => handleSelect(currentLanguage || 'English')}
          >
            {t.continueWithLang} ({currentLanguage || 'English'}) →
          </button>
        </div>
      </div>
    </div>
  )
}

export default LanguageOnboardingModal
