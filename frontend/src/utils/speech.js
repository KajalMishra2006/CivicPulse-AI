/**
 * CivicPulse Multilingual & Web Speech Service
 * Provides browser-native Speech-to-Text (STT) and Text-to-Speech (TTS) for Indian languages.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', name: 'English', nativeName: 'English', flag: '🌐' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिंदी (Hindi)', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' }
]

/**
 * Find language metadata by code or name
 */
export function getLanguageMetadata(nameOrCode = 'English') {
  if (!nameOrCode) return SUPPORTED_LANGUAGES[0]
  const clean = String(nameOrCode).trim().toLowerCase()
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.name.toLowerCase() === clean ||
           l.code.toLowerCase() === clean ||
           l.nativeName.toLowerCase().includes(clean) ||
           clean.includes(l.name.toLowerCase())
  )
  return match || SUPPORTED_LANGUAGES[0]
}

/**
 * Check if the browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Check if the browser supports Text-to-Speech (Speech Synthesis)
 */
export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined')
}

// Module-level cache for synthesized voices and active utterance to prevent GC bugs in Chromium
let cachedVoices = []
let activeUtterance = null

function loadVoices() {
  if (!isSpeechSynthesisSupported()) return []
  try {
    const voices = window.speechSynthesis.getVoices()
    if (voices && voices.length > 0) {
      cachedVoices = voices
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[TTS] Failed to load voices:', e)
  }
  return cachedVoices
}

if (typeof window !== 'undefined' && isSpeechSynthesisSupported()) {
  loadVoices()
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices()
    }
  }
}

/**
 * Explicitly requests microphone permission if supported by navigator.mediaDevices.
 */
export async function requestMicrophonePermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true // Fallback to browser's native speech recognition permission prompt
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop tracks immediately after permission check
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      const deniedErr = new Error('Microphone permission is required for voice reporting. Please allow microphone access in your browser settings.')
      deniedErr.code = 'not-allowed'
      throw deniedErr
    }
    throw err
  }
}

/**
 * Starts a Speech Recognition session with the specified language.
 * Returns a controller object with `stop()` and `abort()` methods.
 */
export function startVoiceRecognition({
  languageName = 'English',
  onResult,
  onError,
  onStart,
  onEnd
}) {
  if (!isSpeechRecognitionSupported()) {
    const error = new Error('Voice recognition is not supported in this browser. Please use Chrome/Edge or type your complaint.')
    error.code = 'UNSUPPORTED'
    if (onError) onError(error)
    return null
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  const langMeta = getLanguageMetadata(languageName)
  recognition.lang = langMeta.code
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let finalTranscript = ''
  let hasEnded = false

  recognition.onstart = () => {
    if (onStart) onStart()
  }

  recognition.onresult = (event) => {
    let interimTranscript = ''
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + transcript.trim()
      } else {
        interimTranscript += transcript
      }
    }

    if (onResult) {
      onResult({
        finalText: finalTranscript,
        interimText: interimTranscript,
        combinedText: (finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim()
      })
    }
  }

  recognition.onerror = (event) => {
    if (import.meta.env?.DEV) console.warn('[VOICE] Speech recognition error event:', event.error)
    let userFriendlyMsg = 'Could not capture voice input. Please try again or type manually.'

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      userFriendlyMsg = 'Microphone permission is required for voice reporting.'
    } else if (event.error === 'no-speech') {
      userFriendlyMsg = 'No speech was detected. Please try speaking closer to your microphone.'
    } else if (event.error === 'network') {
      userFriendlyMsg = 'Network error during speech recognition. Please check your connection or type manually.'
    } else if (event.error === 'aborted') {
      return
    }

    const err = new Error(userFriendlyMsg)
    err.code = event.error
    if (onError) onError(err)
  }

  recognition.onend = () => {
    if (!hasEnded) {
      hasEnded = true
      if (onEnd) onEnd({ finalText: finalTranscript.trim() })
    }
  }

  try {
    recognition.start()
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[VOICE] Failed to start recognition:', err)
    if (onError) onError(err)
    return null
  }

  return {
    stop: () => {
      try {
        hasEnded = true
        recognition.stop()
      } catch (stopErr) {
        if (import.meta.env?.DEV) console.warn('[VOICE] Error stopping recognition:', stopErr)
      }
    },
    abort: () => {
      try {
        hasEnded = true
        recognition.abort()
      } catch (abortErr) {
        if (import.meta.env?.DEV) console.warn('[VOICE] Error aborting recognition:', abortErr)
      }
    }
  }
}

/**
 * Finds the best matching synthesized voice for a given language code / name.
 */
function findBestVoice(langMeta) {
  const voices = loadVoices()
  if (!voices || voices.length === 0) return null

  const targetCode = langMeta.code.toLowerCase()
  const langPrefix = targetCode.split('-')[0]
  const targetName = langMeta.name.toLowerCase()

  // 1. Exact match (e.g. 'mr-in', 'hi-in')
  let match = voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-') === targetCode)
  if (match) return match

  // 2. Prefix match (e.g. 'mr', 'hi', 'gu')
  match = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix))
  if (match) return match

  // 3. Name match (e.g. voice named 'Marathi', 'Hindi')
  match = voices.find((v) => v.name && v.name.toLowerCase().includes(targetName))
  if (match) return match

  // 4. Any Indian English voice if English is target
  if (langPrefix === 'en') {
    match = voices.find((v) => v.lang && v.lang.toLowerCase().includes('en'))
    if (match) return match
  }

  // 5. Default voice
  return voices.find((v) => v.default) || voices[0] || null
}

/**
 * Robust Text-to-Speech playback.
 * Accepts text explicitly as a parameter, ensures no stale React state bugs,
 * selects the best available voice, and safely cancels active speech.
 */
export function playTextToSpeech({
  text,
  languageName = 'English',
  onStart,
  onEnd,
  onError
}) {
  if (!isSpeechSynthesisSupported()) {
    if (onError) onError(new Error('Speech synthesis is not supported in this browser.'))
    return null
  }

  const cleanText = text ? String(text).trim() : ''
  if (!cleanText) {
    if (import.meta.env?.DEV) console.warn('[TTS] Empty text passed to playTextToSpeech.')
    if (onError) onError(new Error('No text to speak.'))
    return null
  }

  try {
    // 1. Cancel previous speech immediately
    window.speechSynthesis.cancel()

    // 2. Create and configure Utterance
    const langMeta = getLanguageMetadata(languageName)
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = langMeta.code
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // 3. Find and attach best matching voice
    const bestVoice = findBestVoice(langMeta)
    if (bestVoice) {
      utterance.voice = bestVoice
    }

    // 4. Attach callbacks
    utterance.onstart = () => {
      if (onStart) onStart()
    }

    utterance.onend = () => {
      activeUtterance = null
      if (onEnd) onEnd()
    }

    utterance.onerror = (event) => {
      activeUtterance = null
      // Do not report cancellation or interruption as failure
      if (event.error === 'canceled' || event.error === 'interrupted') {
        return
      }
      if (import.meta.env?.DEV) console.warn('[TTS] Playback error event:', event.error)
      if (onError) onError(new Error(`Speech synthesis error: ${event.error || 'unknown'}`))
    }

    // Retain module-level reference to protect against Chromium GC bug
    activeUtterance = utterance

    // 5. Trigger speech
    window.speechSynthesis.speak(utterance)
    return utterance
  } catch (err) {
    activeUtterance = null
    if (import.meta.env?.DEV) console.error('[TTS] Error invoking speech synthesis:', err)
    if (onError) onError(err)
    return null
  }
}

/**
 * Stop any ongoing speech synthesis playback
 */
export function stopTextToSpeech() {
  if (isSpeechSynthesisSupported()) {
    try {
      activeUtterance = null
      window.speechSynthesis.cancel()
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[TTS] Error canceling speech synthesis:', err)
    }
  }
}

/**
 * Returns currently active speech utterance if any
 */
export function getActiveUtterance() {
  return activeUtterance
}
