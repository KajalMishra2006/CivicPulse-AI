import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './config.js'

/**
 * Register a new user with Email, Password, and extended profile fields.
 */
export async function registerUser(name, email, password, country, state, localArea) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  const user = userCredential.user

  // Update Auth Profile Display Name
  if (name) {
    await updateProfile(user, { displayName: name })
  }

  // Create User Profile Document in Firestore
  const userDocRef = doc(db, 'users', user.uid)
  await setDoc(userDocRef, {
    uid: user.uid,
    name: name || '',
    email: user.email || email,
    role: 'citizen',
    verified: false,
    country: country || '',
    state: state || '',
    localArea: localArea || '',
    createdAt: serverTimestamp()
  })

  return user
}

/**
 * Log in an existing user with Email and Password.
 */
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  return userCredential.user
}

/**
 * Log in or Sign Up using Google Popup.
 */
export async function loginWithGoogle() {
  const userCredential = await signInWithPopup(auth, googleProvider)
  const user = userCredential.user

  // Check if profile document already exists in Firestore
  const userDocRef = doc(db, 'users', user.uid)
  const userDocSnap = await getDoc(userDocRef)

  if (!userDocSnap.exists()) {
    // Create new profile for Google user if first time
    await setDoc(userDocRef, {
      uid: user.uid,
      name: user.displayName || 'Civic User',
      email: user.email,
      role: 'citizen',
      verified: false,
      country: '',
      state: '',
      localArea: '',
      createdAt: serverTimestamp()
    })
  }

  return user
}

/**
 * Log out the current user.
 */
export async function logoutUser() {
  await signOut(auth)
}

/**
 * Fetch extended profile document from Firestore.
 * Safely normalizes missing role to 'citizen' and missing verified to false.
 */
export async function getUserProfile(uid) {
  if (!uid) return null
  const userDocRef = doc(db, 'users', uid)
  const userDocSnap = await getDoc(userDocRef)
  if (userDocSnap.exists()) {
    const rawData = userDocSnap.data()
    return {
      ...rawData,
      // Default to 'citizen' unless explicitly 'admin' or 'official'
      role: (rawData.role === 'admin' || rawData.role === 'official') ? rawData.role : 'citizen',
      // Default verified to false unless explicitly true
      verified: rawData.verified === true
    }
  }
  return null
}

/**
 * Format Firebase Auth errors into clear, actionable user messages.
 */
export function formatAuthError(err) {
  if (!err) return 'An unexpected error occurred.'
  const code = err.code || ''

  switch (code) {
    case 'auth/api-key-not-valid-please-pass-a-valid-api-key':
    case 'auth/invalid-api-key':
      return 'Invalid Firebase API Key. Please replace the placeholder API key in your .env file with your actual Firebase Web App configuration from the Firebase Console (Project Settings > General > Your apps).'
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please log in instead.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials and try again.'
    case 'auth/operation-not-allowed':
      return 'This authentication method is not enabled. Please enable Email/Password (or Google) Sign-in in your Firebase Console (Build > Authentication > Sign-in method).'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for OAuth operations. Please add localhost / 127.0.0.1 in Firebase Console (Authentication > Settings > Authorized domains).'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication.'
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.'
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Please reset your password or try again later.'
    default:
      return err.message || 'An authentication error occurred. Please try again.'
  }
}

