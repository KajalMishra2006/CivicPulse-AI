import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase Web App Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

// Check if Firebase is using a placeholder or missing API key
export const isPlaceholderKey =
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.includes('FakeKey') ||
  firebaseConfig.apiKey === 'AIzaSyFakeKeyForLocalSetup0123456789'

if (typeof window !== 'undefined') {
  console.log('[FIREBASE PROJECT]', firebaseConfig.projectId)
  console.log('[FIREBASE AUTH DOMAIN]', firebaseConfig.authDomain)
}

if (isPlaceholderKey && typeof window !== 'undefined') {
  console.warn(
    '⚠️ [CivicPulse-AI] Firebase API key is currently set to a placeholder or is missing. ' +
    'To connect to your live Firebase project, please update your .env file with your real Firebase Web App configuration from the Firebase Console (Project Settings > General > Your apps).'
  )
}

// Initialize Firebase safely without duplicate initialization
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

export default app
