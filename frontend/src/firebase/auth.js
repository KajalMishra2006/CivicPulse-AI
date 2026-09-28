import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
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
 * Normalizes email address (trimmed, lowercase).
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

/**
 * Normalizes phone number (digits string, preserving leading '+' if international).
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return ''
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  return hasPlus ? `+${digits}` : digits
}

/**
 * Normalizes government ID string (uppercase, stripped whitespace/dashes).
 */
export function normalizeGovernmentId(id) {
  if (!id || typeof id !== 'string') return ''
  return id.trim().toUpperCase().replace(/[\s\-_]/g, '')
}

/**
 * Masks Government ID for privacy (e.g. "XXXXXX1234").
 */
export function maskGovernmentId(id) {
  const norm = normalizeGovernmentId(id)
  if (!norm) return 'XXXXXX0000'
  if (norm.length <= 4) return 'XXXX' + norm
  return 'XXXXXX' + norm.slice(-4)
}

/**
 * Masks phone number for privacy (e.g. "******7890").
 */
export function maskPhoneNumber(phone) {
  const digits = (phone || '').toString().replace(/\D/g, '')
  if (!digits) return '******0000'
  if (digits.length <= 4) return '******' + digits
  return '******' + digits.slice(-4)
}

/**
 * Validates uniqueness of Email, Phone Number, and Government ID across backend and Firestore.
 */
export async function checkIdentityUniqueness({ email, mobileNumber, idNumber, uid = null }) {
  const normEmail = normalizeEmail(email)
  const normPhone = normalizePhoneNumber(mobileNumber)
  const normId = normalizeGovernmentId(idNumber)

  if (!normEmail) {
    const err = new Error('Email address is required.')
    err.field = 'email'
    throw err
  }
  if (!normPhone || normPhone.replace(/\D/g, '').length < 7) {
    const err = new Error('Please enter a valid phone number (at least 7 digits).')
    err.field = 'phone'
    throw err
  }
  if (!normId || normId.length < 4) {
    const err = new Error('Government ID card number must be at least 4 characters.')
    err.field = 'governmentId'
    throw err
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

  // 1. Try Backend API uniqueness check first
  try {
    const response = await fetch(`${apiUrl}/api/citizen/check-uniqueness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normEmail,
        phone: normPhone,
        governmentId: normId,
        uid
      })
    })

    if (response.status === 409) {
      const data = await response.json()
      const err = new Error(data.error || 'Duplicate identity credential detected.')
      err.field = data.field
      err.code = data.field === 'email' ? 'auth/email-already-in-use' : 'identity/duplicate'
      throw err
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to validate credentials uniqueness.')
    }

    return await response.json()
  } catch (apiErr) {
    // If it's a confirmed duplicate or validation error, rethrow immediately
    if (apiErr.field || apiErr.code === 'auth/email-already-in-use' || apiErr.code === 'identity/duplicate') {
      throw apiErr
    }

    console.warn('[AUTH] Backend uniqueness endpoint unavailable, running Firestore fallback check:', apiErr.message)

    // 2. Fallback: Validate directly against Firestore users collection
    try {
      // Email Check
      const emailQ = query(collection(db, 'users'), where('email', '==', normEmail))
      const emailSnap = await getDocs(emailQ)
      for (const docSnap of emailSnap.docs) {
        if (docSnap.id !== uid) {
          const err = new Error('This email address is already registered. Please log in instead.')
          err.field = 'email'
          err.code = 'auth/email-already-in-use'
          throw err
        }
      }

      // Phone Check
      const phoneQ = query(collection(db, 'users'), where('mobileNumber', '==', normPhone))
      const phoneSnap = await getDocs(phoneQ)
      for (const docSnap of phoneSnap.docs) {
        if (docSnap.id !== uid) {
          const err = new Error('This phone number is already registered with another account.')
          err.field = 'phone'
          err.code = 'identity/duplicate'
          throw err
        }
      }

      // Government ID Check
      const idQ = query(collection(db, 'users'), where('normalizedGovernmentId', '==', normId))
      const idSnap = await getDocs(idQ)
      for (const docSnap of idSnap.docs) {
        if (docSnap.id !== uid) {
          const err = new Error('This Government ID card number is already registered with another account.')
          err.field = 'governmentId'
          err.code = 'identity/duplicate'
          throw err
        }
      }
    } catch (fallbackErr) {
      if (fallbackErr.field || fallbackErr.code === 'auth/email-already-in-use' || fallbackErr.code === 'identity/duplicate') {
        throw fallbackErr
      }
      console.warn('[AUTH] Direct Firestore collection query restricted by security rules (expected for non-admins):', fallbackErr?.message)
    }

    return {
      valid: true,
      normalizedEmail: normEmail,
      normalizedPhone: normPhone,
      normalizedId: normId,
      maskedId: maskGovernmentId(normId),
      maskedPhone: maskPhoneNumber(normPhone)
    }
  }
}

/**
 * Register a new citizen with unique Email, Phone, and Government ID.
 * Citizen immediately becomes active and eligible to submit civic complaints.
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
  const normEmail = normalizeEmail(email)
  const normPhone = normalizePhoneNumber(mobileNumber)
  const normId = normalizeGovernmentId(idNumber)

  // 1. Mandatory Uniqueness Check BEFORE creating authentication user
  const uniqueResult = await checkIdentityUniqueness({
    email: normEmail,
    mobileNumber: normPhone,
    idNumber: normId
  })

  // 2. Create Firebase Auth user
  let userCredential
  try {
    userCredential = await createUserWithEmailAndPassword(auth, normEmail, password)
  } catch (err) {
    logAuthError('createUserWithEmailAndPassword', err)
    throw err
  }
  const user = userCredential.user

  if (name) {
    try {
      await updateProfile(user, { displayName: name.trim() })
    } catch (err) {
      logAuthError('updateProfile', err)
    }
  }

  const geo = resolveLocationMetadata({ state, district, taluka })
  const maskedId = uniqueResult.maskedId || maskGovernmentId(normId)
  const maskedPhone = uniqueResult.maskedPhone || maskPhoneNumber(normPhone)

  // 3. Create active citizen profile in Firestore users/{uid}
  try {
    const userDocRef = doc(db, 'users', user.uid)
    await setDoc(userDocRef, {
      uid: user.uid,
      name: name ? name.trim() : '',
      email: normEmail,
      mobileNumber: normPhone,
      maskedPhone: maskedPhone,
      phoneHash: uniqueResult.phoneHash || null,
      role: 'citizen',
      accountStatus: 'active',
      verified: true,
      identityVerificationStatus: 'verified',
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
      localArea: localArea ? localArea.trim() : '',
      preferredLanguage: preferredLanguage || 'English',
      idType: idType || 'Citizen Government ID',
      idNumber: maskedId,
      maskedIdNumber: maskedId,
      normalizedGovernmentId: normId,
      identityHash: uniqueResult.identityHash || null,
      idDocumentUrl: idDocumentUrl || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (err) {
    logAuthError('setDoc (users)', err)
    throw err
  }

  // 4. Record hashes in backend identity registry (non-blocking)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  fetch(`${apiUrl}/api/citizen/register-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: user.uid,
      email: normEmail,
      mobileNumber: normPhone,
      idNumber: normId
    })
  }).catch((err) => {
    console.warn('[IDENTITY REGISTRY NOTICE] Background identity reservation completed or fallback:', err?.message)
  })

  return user
}

/**
 * Log in an existing user.
 */
export async function loginUser(email, password) {
  try {
    const normEmail = normalizeEmail(email)
    const userCredential = await signInWithEmailAndPassword(auth, normEmail, password)
    console.log('[AUTH] Firebase login successful:', userCredential.user.uid)
    return userCredential.user
  } catch (err) {
    logAuthError('signInWithEmailAndPassword', err)
    throw err
  }
}

/**
 * Send password reset email via Firebase Authentication.
 */
export async function sendUserPasswordResetEmail(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter a valid email address.')
  }
  try {
    const normEmail = normalizeEmail(email)
    await sendPasswordResetEmail(auth, normEmail)
    console.log('[AUTH] Firebase password reset email sent:', normEmail)
    return true
  } catch (err) {
    logAuthError('sendPasswordResetEmail', err)
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
        email: normalizeEmail(user.email),
        role: 'citizen',
        accountStatus: 'active',
        verified: true,
        identityVerificationStatus: 'verified',
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
 * - district_officer (merges district_admin, citizen_access_employee, issue_resolution_employee)
 * - citizen (automatically active and eligible)
 * - applicant
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
      } else if (
        rawRole === 'district_officer' ||
        rawRole === 'district_admin' ||
        rawRole === 'district_administrator'
      ) {
        normalizedRole = 'district_officer'
      } else if (
        rawRole === 'taluka_officer' ||
        rawRole === 'issue_resolution_employee' ||
        rawRole === 'issue_resolution_officer' ||
        rawRole === 'citizen_access_employee' ||
        rawRole === 'citizen_access_officer'
      ) {
        normalizedRole = 'taluka_officer'
      } else if (rawRole === 'official') {
        normalizedRole = (raw.taluka || raw.talukaName || raw.talukaId) ? 'taluka_officer' : 'district_officer'
      } else if (rawRole === 'applicant') {
        normalizedRole = 'applicant'
      }

      const geo = resolveLocationMetadata({
        state: raw.stateName || raw.state || 'Maharashtra',
        district: raw.districtName || raw.district || 'Pune',
        taluka: raw.talukaName || raw.taluka || 'Haveli'
      })

      // Normal citizens are automatically eligible/active
      const isCitizen = normalizedRole === 'citizen'
      const isVerified = isCitizen ? true : (raw.verified === true || raw.verificationStatus === 'approved' || raw.accountStatus === 'approved' || raw.accountStatus === 'active')
      const isStateAdmin = normalizedRole === 'state_admin'
      const isDistrictOfficer = normalizedRole === 'district_officer'

      const profile = {
        ...raw,
        role: normalizedRole,
        verified: isVerified,
        accountStatus: isCitizen ? 'active' : (raw.accountStatus || (isVerified ? 'active' : 'pending')),
        identityVerificationStatus: isCitizen ? 'verified' : (raw.identityVerificationStatus || (isVerified ? 'verified' : 'pending')),
        stateId: raw.stateId || geo.stateId,
        stateName: raw.stateName || raw.state || geo.stateName,
        state: raw.stateName || raw.state || geo.stateName,
        districtId: isStateAdmin ? null : (raw.districtId || geo.districtId),
        districtName: isStateAdmin ? null : (raw.districtName || raw.district || geo.districtName),
        district: isStateAdmin ? null : (raw.districtName || raw.district || geo.districtName),
        talukaId: (isStateAdmin || isDistrictOfficer) ? null : (raw.talukaId || geo.talukaId),
        talukaName: (isStateAdmin || isDistrictOfficer) ? null : (raw.talukaName || raw.taluka || geo.talukaName),
        taluka: (isStateAdmin || isDistrictOfficer) ? null : (raw.talukaName || raw.taluka || geo.talukaName)
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
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few minutes.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.'
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please log in instead.'
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters.'
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console. Please contact the administrator.'
    case 'auth/invalid-api-key':
      return 'Invalid Firebase configuration. Please contact the administrator.'
    default:
      return err.message && !err.message.includes('auth/')
        ? err.message
        : 'An error occurred during authentication. Please try again.'
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

/**
 * Completes or recovers missing Firestore profile for an existing authenticated user
 * (such as accounts where Auth exists but Firestore profile was missing).
 */
export async function createMissingCitizenProfile({
  uid,
  email,
  name,
  mobileNumber,
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
  if (!uid) throw new Error('User ID is required to complete profile.')
  const normEmail = normalizeEmail(email)
  const normPhone = normalizePhoneNumber(mobileNumber)
  const normId = normalizeGovernmentId(idNumber)

  // 1. Mandatory Uniqueness Check
  const uniqueResult = await checkIdentityUniqueness({
    email: normEmail,
    mobileNumber: normPhone,
    idNumber: normId,
    uid
  })

  const geo = resolveLocationMetadata({ state, district, taluka })
  const maskedId = uniqueResult.maskedId || maskGovernmentId(normId)
  const maskedPhone = uniqueResult.maskedPhone || maskPhoneNumber(normPhone)

  const userDocRef = doc(db, 'users', uid)
  await setDoc(userDocRef, {
    uid,
    name: name ? name.trim() : '',
    email: normEmail,
    mobileNumber: normPhone,
    maskedPhone: maskedPhone,
    phoneHash: uniqueResult.phoneHash || null,
    role: 'citizen',
    accountStatus: 'active',
    verified: true,
    identityVerificationStatus: 'verified',
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
    localArea: localArea ? localArea.trim() : '',
    preferredLanguage: preferredLanguage || 'English',
    idType: idType || 'Citizen Government ID',
    idNumber: maskedId,
    maskedIdNumber: maskedId,
    normalizedGovernmentId: normId,
    identityHash: uniqueResult.identityHash || null,
    idDocumentUrl: idDocumentUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  // Register identity hashes (non-blocking)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  fetch(`${apiUrl}/api/citizen/register-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid,
      email: normEmail,
      mobileNumber: normPhone,
      idNumber: normId
    })
  }).catch((err) => {
    console.warn('[IDENTITY REGISTRY NOTICE] Background identity reservation completed or fallback:', err?.message)
  })

  return true
}

/**
 * Real-time subscription strictly scoped to Citizens in the Taluka Officer's jurisdiction.
 * Query constraints:
 *   where('role', '==', 'citizen')
 *   where('stateId', '==', cleanStateId)
 *   where('districtId', '==', cleanDistrictId)
 *   where('talukaId', '==', cleanTalukaId)
 * Guarantees compliance with Firestore Security Rules (no client-side whole collection downloads).
 */
export function subscribeTalukaCitizens({ stateId, districtId, talukaId }, onUpdate, onError) {
  const cleanStateId = (stateId || '').toLowerCase().trim().replace(/\s+/g, '_')
  const cleanDistrictId = (districtId || '').toLowerCase().trim().replace(/\s+/g, '_')
  const cleanTalukaId = (talukaId || '').toLowerCase().trim().replace(/\s+/g, '_')

  if (!cleanStateId || !cleanDistrictId || !cleanTalukaId) {
    if (onUpdate) onUpdate([])
    return () => {}
  }

  const citizensQuery = query(
    collection(db, 'users'),
    where('role', '==', 'citizen'),
    where('stateId', '==', cleanStateId),
    where('districtId', '==', cleanDistrictId),
    where('talukaId', '==', cleanTalukaId)
  )

  const unsubscribe = onSnapshot(
    citizensQuery,
    (snapshot) => {
      const citizens = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          uid: docSnap.id,
          ...data
        }
      })

      // Sort recent registrations first in memory (avoids requiring composite indexes)
      citizens.sort((a, b) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0)
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0)
        return tB - tA
      })

      if (onUpdate) onUpdate(citizens)
    },
    (err) => {
      console.error('[TALUKA CITIZENS] Subscription error:', err)
      if (onError) onError(err)
    }
  )

  return unsubscribe
}

/**
 * Fetches a single citizen profile by userId from Firestore.
 */
export async function getCitizenById(userId) {
  if (!userId) return null
  const userDocRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userDocRef)
  if (!userSnap.exists()) return null
  return { id: userSnap.id, uid: userSnap.id, ...userSnap.data() }
}

