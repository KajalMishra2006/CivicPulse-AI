import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './config.js'
import { resolveLocationMetadata } from '../utils/locations.js'

function logAuthError(op, error) {
  console.error('[AUTH ERROR]', {
    code: error?.code,
    message: error?.message,
    operation: op,
    authDomain: auth?.config?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: auth?.config?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
  })
}

/**
 * Register a new citizen with State, District, Taluka, and Identity Document.
 * Account starts as PENDING_VERIFICATION.
 */
export async function registerUser({
  name,
  email,
  password,
  mobileNumber = '',
  country = 'India',
  state = 'Maharashtra',
  district = 'Pune',
  taluka = 'Haveli',
  localArea = '',
  preferredLanguage = 'English',
  idType = 'Citizen Government ID',
  idNumber = '',
  idDocumentUrl = null
}) {
  let userCredential
  try {
    userCredential = await createUserWithEmailAndPassword(auth, email, password)
  } catch (err) {
    logAuthError('createUserWithEmailAndPassword', err)
    throw err
  }
  const user = userCredential.user

  if (name) {
    try {
      await updateProfile(user, { displayName: name })
    } catch (err) {
      logAuthError('updateProfile', err)
    }
  }

  const geo = resolveLocationMetadata({ state, district, taluka })

  try {
    const userDocRef = doc(db, 'users', user.uid)
    await setDoc(userDocRef, {
      uid: user.uid,
      name: name || '',
      email: user.email || email,
      mobileNumber: mobileNumber || '',
      role: 'citizen',
      accountStatus: 'pending',
      verified: false,
      identityVerificationStatus: 'pending',
      country: country || 'India',
      stateId: geo.stateId,
      stateName: geo.stateName,
      state: geo.stateName,
      districtId: geo.districtId,
      districtName: geo.districtName,
      district: geo.districtName,
      talukaId: geo.talukaId,
      talukaName: geo.talukaName,
      taluka: geo.talukaName,
      localArea: localArea || '',
      preferredLanguage: preferredLanguage || 'English',
      idType: idType || 'Citizen Government ID',
      idNumber: idNumber || '',
      idDocumentUrl: idDocumentUrl || null,
      identitySubmittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (err) {
    logAuthError('setDoc (users)', err)
    throw err
  }

  return user
}

/**
 * Log in an existing user.
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    console.log('[AUTH] Firebase login successful:', userCredential.user.uid)
    return userCredential.user
  } catch (err) {
    logAuthError('signInWithEmailAndPassword', err)
    throw err
  }
}

/**
 * Log in or Sign Up using Google.
 */
export async function loginWithGoogle() {
  let userCredential
  try {
    userCredential = await signInWithPopup(auth, googleProvider)
    console.log('[AUTH] Firebase Google login successful:', userCredential.user.uid)
  } catch (err) {
    logAuthError('signInWithPopup', err)
    throw err
  }
  const user = userCredential.user

  try {
    const userDocRef = doc(db, 'users', user.uid)
    const userDocSnap = await getDoc(userDocRef)

    if (!userDocSnap.exists()) {
      const defaultGeo = resolveLocationMetadata({ state: 'Maharashtra', district: 'Pune', taluka: 'Haveli' })

      await setDoc(userDocRef, {
        uid: user.uid,
        name: user.displayName || 'Civic User',
        email: user.email,
        role: 'citizen',
        accountStatus: 'pending',
        verified: false,
        identityVerificationStatus: 'pending',
        country: 'India',
        stateId: defaultGeo.stateId,
        stateName: defaultGeo.stateName,
        state: defaultGeo.stateName,
        districtId: defaultGeo.districtId,
        districtName: defaultGeo.districtName,
        district: defaultGeo.districtName,
        talukaId: defaultGeo.talukaId,
        talukaName: defaultGeo.talukaName,
        taluka: defaultGeo.talukaName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }
  } catch (err) {
    logAuthError('getDoc/setDoc (loginWithGoogle)', err)
    throw err
  }

  return user
}

/**
 * Log out the current user.
 */
export async function logoutUser() {
  try {
    await signOut(auth)
  } catch (err) {
    logAuthError('signOut', err)
    throw err
  }
}

/**
 * Standardize and map roles into the hierarchical RBAC system:
 * - super_admin (or admin)
 * - state_admin
 * - district_admin
 * - citizen_access_employee (or citizen_access_officer)
 * - issue_resolution_employee (or issue_resolution_officer / official)
 * - citizen
 */
export async function getUserProfile(uid) {
  if (!uid) return null
  try {
    console.log('[AUTH] Loading Firestore profile...')
    const userDocRef = doc(db, 'users', uid)
    const userDocSnap = await getDoc(userDocRef)
    if (userDocSnap.exists()) {
      const raw = userDocSnap.data()

      let normalizedRole = 'citizen'
      const rawRole = (raw.role || '').toLowerCase().trim()
      if (rawRole === 'super_admin' || rawRole === 'admin') {
        normalizedRole = 'super_admin'
      } else if (rawRole === 'state_admin') {
        normalizedRole = 'state_admin'
      } else if (rawRole === 'district_admin') {
        normalizedRole = 'district_admin'
      } else if (rawRole === 'citizen_access_employee' || rawRole === 'citizen_access_officer') {
        normalizedRole = 'citizen_access_employee'
      } else if (rawRole === 'issue_resolution_employee' || rawRole === 'issue_resolution_officer' || rawRole === 'official') {
        normalizedRole = 'issue_resolution_employee'
      } else if (rawRole === 'applicant') {
        normalizedRole = 'applicant'
      }

      const geo = resolveLocationMetadata({
        state: raw.stateName || raw.state || 'Maharashtra',
        district: raw.districtName || raw.district || 'Pune',
        taluka: raw.talukaName || raw.taluka || 'Haveli'
      })

      const profile = {
        ...raw,
        role: normalizedRole,
        verified: raw.verified === true || raw.verificationStatus === 'approved' || raw.accountStatus === 'approved' || raw.identityVerificationStatus === 'verified',
        accountStatus: raw.accountStatus || (raw.verified ? 'active' : 'pending'),
        identityVerificationStatus: raw.identityVerificationStatus || (raw.verified ? 'verified' : 'pending'),
        stateId: raw.stateId || geo.stateId,
        stateName: raw.stateName || raw.state || geo.stateName,
        state: raw.stateName || raw.state || geo.stateName,
        districtId: raw.districtId || (normalizedRole === 'state_admin' ? null : geo.districtId),
        districtName: raw.districtName || (normalizedRole === 'state_admin' ? null : geo.districtName),
        district: raw.districtName || (normalizedRole === 'state_admin' ? null : geo.districtName),
        talukaId: raw.talukaId || ((normalizedRole === 'state_admin' || normalizedRole === 'district_admin') ? null : geo.talukaId),
        talukaName: raw.talukaName || ((normalizedRole === 'state_admin' || normalizedRole === 'district_admin') ? null : geo.talukaName),
        taluka: raw.talukaName || ((normalizedRole === 'state_admin' || normalizedRole === 'district_admin') ? null : geo.talukaName)
      }

      console.log('[AUTH] Profile loaded:', profile.role)
      return profile
    }

    console.warn('[AUTH] Profile not found in Firestore for UID:', uid)
    return null
  } catch (err) {
    logAuthError('getDoc (getUserProfile)', err)
    throw err
  }
}

/**
 * Format Firebase Auth errors into clear, actionable messages.
 */
export function formatAuthError(err) {
  if (!err) return 'An unexpected error occurred.'
  const code = err.code || ''

  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.'
    case 'auth/user-not-found':
      return 'No account found with this official email address.'
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify and try again.'
    case 'auth/network-request-failed':
      return 'Network request failed. Please check your internet connection, proxy, or VPN.'
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please reset your password or try again later.'
    case 'auth/invalid-api-key':
      return 'Invalid Firebase API key. Please check your project configuration.'
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console. Please contact the administrator.'
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please log in instead.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters.'
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.'
    default:
      return err.message || 'Authentication error. Please try again.'
  }
}

/**
 * Update preferred language in user profile.
 */
export async function updateUserLanguage(uid, preferredLanguage) {
  if (!uid || !preferredLanguage) return
  const userDocRef = doc(db, 'users', uid)
  await updateDoc(userDocRef, {
    preferredLanguage,
    updatedAt: serverTimestamp()
  })
}
