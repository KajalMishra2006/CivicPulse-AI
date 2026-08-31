/**
 * CivicPulse Dynamic Complaint Translation Service
 * Connects securely to the standalone backend /api/translate endpoint.
 * Includes client-side caching to prevent redundant API calls.
 */

const translationCache = new Map()

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'

/**
 * Dynamically translate citizen complaint text into the selected government language.
 * @param {object} params
 * @param {string} params.text - The original complaint description.
 * @param {string} params.sourceLanguage - The citizen's submission language (e.g. 'Marathi').
 * @param {string} params.targetLanguage - The official's target language (e.g. 'Hindi', 'Gujarati').
 * @param {string} [params.englishFallback] - Existing Gemini aiTranslatedText if target is English.
 * @returns {Promise<string>} Translated text string.
 */
export async function translateComplaintText({ text, sourceLanguage, targetLanguage, englishFallback }) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return ''
  }

  const cleanText = text.trim()
  const cleanSource = (sourceLanguage || 'Auto').trim()
  const cleanTarget = (targetLanguage || 'English').trim()

  console.log('[TRANSLATE REQUEST]', {
    sourceLanguage: cleanSource,
    targetLanguage: cleanTarget,
    text: cleanText.length > 50 ? `${cleanText.slice(0, 50)}...` : cleanText,
    url: `${API_BASE_URL}/api/translate`
  })

  // 1. If target matches source language, return original text immediately
  if (cleanSource.toLowerCase() === cleanTarget.toLowerCase()) {
    console.log('[TRANSLATE] Source matches target language. Returning original text.')
    return cleanText
  }

  // 2. If target is English and we already have aiTranslatedText, return it immediately
  if (cleanTarget.toLowerCase() === 'english' && englishFallback && englishFallback.trim()) {
    console.log('[TRANSLATE] Target is English. Using existing aiTranslatedText.')
    return englishFallback.trim()
  }

  // 3. Cache lookup
  const cacheKey = `${cleanSource}_${cleanTarget}_${cleanText}`
  if (translationCache.has(cacheKey)) {
    console.log('[TRANSLATE] Serving translation from client cache.')
    return translationCache.get(cacheKey)
  }

  // 4. Secure API call to standalone backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        sourceLanguage: cleanSource,
        targetLanguage: cleanTarget,
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `Server responded with status ${response.status}`)
    }

    const data = await response.json()
    const translated = (data.translatedText || '').trim()

    if (translated) {
      console.log('[TRANSLATE RESPONSE SUCCESS]', {
        targetLanguage: cleanTarget,
        translated: translated.length > 50 ? `${translated.slice(0, 50)}...` : translated
      })
      translationCache.set(cacheKey, translated)
      return translated
    }

    return cleanText
  } catch (err) {
    console.error('[TRANSLATE API ERROR]', err)
    throw new Error('Translation failed. Check that the CivicPulse backend is running.', { cause: err })
  }
}

export const translateComplaintDynamic = translateComplaintText

