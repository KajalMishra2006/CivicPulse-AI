import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import crypto from 'node:crypto'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Helper to load .env variables
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
    path.join(process.cwd(), '.env')
  ]

  const envConfig = {}
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=')
          envConfig[key.trim()] = rest.join('=').trim()
        }
      }
      break
    }
  }

  return envConfig
}

const env = loadEnv()
const defaultProjectId = env.VITE_FIREBASE_PROJECT_ID || 'civicpulse-ai-41cd1'

// 2. Reliable HTTPS request helper using node:https with custom agent
const sslAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' ? false : false,
  keepAlive: false
})

function httpsRequest(urlStr, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: sslAgent
    }

    if (data && typeof data === 'object' && !Buffer.isBuffer(data) && !(data instanceof URLSearchParams)) {
      data = JSON.stringify(data)
      reqOptions.headers['Content-Type'] = 'application/json'
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data)
    } else if (data instanceof URLSearchParams) {
      data = data.toString()
      reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data)
    }

    const req = https.request(reqOptions, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(body)
        } catch {
          // not JSON
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(json || {}),
          text: () => Promise.resolve(body)
        })
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    if (data) {
      req.write(data)
    }
    req.end()
  })
}

// 3. Locate service account credentials
function loadServiceAccount() {
  const customPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS
  if (customPath && fs.existsSync(customPath)) {
    return JSON.parse(fs.readFileSync(customPath, 'utf-8'))
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (rawKey) {
    if (fs.existsSync(rawKey)) {
      return JSON.parse(fs.readFileSync(rawKey, 'utf-8'))
    }
    try {
      return JSON.parse(rawKey)
    } catch {
      // fallback
    }
  }

  const searchPaths = [
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../../serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(__dirname, '../firebase-service-account.json'),
    path.join(process.cwd(), 'firebase-service-account.json')
  ]

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  }

  return null
}

// 4. Generate Google OAuth2 Access Token from Service Account Key using Node.js crypto
async function getGoogleAccessToken(serviceAccount) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: iat
  }

  const base64UrlEncode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

  const encodedHeader = base64UrlEncode(header)
  const encodedClaimSet = base64UrlEncode(claimSet)
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsignedToken)
  const signature = signer
    .sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const signedJwt = `${unsignedToken}.${signature}`

  const tokenRes = await httpsRequest('https://oauth2.googleapis.com/token', {
    method: 'POST'
  }, new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJwt
  }))

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Failed to obtain Google access token: ${errText}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

// 5. Prompt helper
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// 6. Main Bootstrap Handler
async function bootstrapAdmin() {
  console.log('\n======================================================')
  console.log('🛡️  CivicPulse-AI: Initial Admin Bootstrap (Admin SDK)')
  console.log('======================================================\n')

  try {
    const serviceAccount = loadServiceAccount()
    if (!serviceAccount) {
      console.error('❌ [ERROR] Firebase service account credentials not found.')
      console.error('\nTo configure credentials:')
      console.error('  1. Download a service account JSON from Firebase Console > Project Settings > Service accounts.')
      console.error('  2. Place it at "frontend/serviceAccountKey.json".')
      console.error('  3. Re-run: npm run bootstrap:admin\n')
      process.exit(1)
    }

    const projectId = serviceAccount.project_id || defaultProjectId
    console.log(`✓ Loaded service account for project: "${projectId}"`)

    console.log('⏳ Authenticating with Google Cloud APIs...')
    const accessToken = await getGoogleAccessToken(serviceAccount)
    console.log('✓ Google Cloud Admin authorization established.\n')

    // Check Single-Admin Lock via Firestore REST API
    console.log('🔍 Checking for existing administrator accounts in Firestore...')
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'role' },
            op: 'EQUAL',
            value: { stringValue: 'admin' }
          }
        }
      }
    }

    const checkRes = await httpsRequest(queryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }, queryBody)

    if (!checkRes.ok) {
      const err = await checkRes.text()
      throw new Error(`Firestore query error: ${err}`)
    }

    const queryResults = await checkRes.json()
    const foundAdmins = Array.isArray(queryResults)
      ? queryResults.filter((r) => r.document && r.document.fields)
      : []

    if (foundAdmins.length > 0) {
      console.error('\n❌ [BOOTSTRAP LOCKED] An administrator account already exists in Firestore.')
      foundAdmins.forEach((docSnap) => {
        const docName = docSnap.document.name.split('/').pop()
        const email = docSnap.document.fields?.email?.stringValue || 'N/A'
        console.error(`   Found Admin: ${email} (Doc: ${docName})`)
      })
      console.error('   For security reasons, this bootstrap tool can only create the initial admin account.\n')
      process.exit(1)
    }

    console.log('✓ No existing administrator found. Proceeding with initial setup.\n')

    // Collect Admin details
    const args = process.argv.slice(2)
    let email = args[0]
    let password = args[1]
    let name = args[2] || 'System Administrator'

    if (!email) {
      email = await promptUser('Enter Admin Email Address: ')
    }
    if (!password) {
      password = await promptUser('Enter Admin Password (min 8 chars): ')
    }

    if (!email || !email.includes('@')) {
      console.error('❌ Please enter a valid email address.')
      process.exit(1)
    }

    if (!password || password.length < 8) {
      console.error('❌ Password must be at least 8 characters long.')
      process.exit(1)
    }

    console.log(`\n⏳ Bootstrapping admin account for "${email}"...`)

    let uid = null
    let isNewlyCreated = false

    // Create Firebase Auth user via Identity Toolkit REST API
    const createUserUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`
    const createUserRes = await httpsRequest(createUserUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }, {
      email: email,
      password: password,
      displayName: name,
      emailVerified: true
    })

    const createUserData = await createUserRes.json()

    if (createUserRes.ok && createUserData.localId) {
      uid = createUserData.localId
      isNewlyCreated = true
      console.log(`✓ Firebase Authentication user created (UID: ${uid}).`)
    } else if (createUserData.error?.message?.includes('EMAIL_EXISTS')) {
      console.log(`ℹ️  Firebase Auth user already exists for "${email}". Looking up UID...`)
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`
      const lookupRes = await httpsRequest(lookupUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }, { email: [email] })
      const lookupData = await lookupRes.json()
      if (lookupData.users && lookupData.users.length > 0) {
        uid = lookupData.users[0].localId
        console.log(`✓ Found existing user (UID: ${uid}). Elevating account...`)
      } else {
        throw new Error('User exists but could not be retrieved.')
      }
    } else {
      throw new Error(`Auth creation failed: ${JSON.stringify(createUserData.error || createUserData)}`)
    }

    // Write Firestore users/{uid} Document
    const nowIso = new Date().toISOString()
    const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`

    const firestorePayload = {
      fields: {
        uid: { stringValue: uid },
        name: { stringValue: name },
        email: { stringValue: email.toLowerCase() },
        role: { stringValue: 'admin' },
        verified: { booleanValue: true },
        country: { stringValue: 'System' },
        state: { stringValue: 'Administration' },
        localArea: { stringValue: 'HQ' },
        createdAt: { timestampValue: nowIso },
        bootstrappedAt: { timestampValue: nowIso }
      }
    }

    const firestoreRes = await httpsRequest(firestoreDocUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }, firestorePayload)

    if (!firestoreRes.ok) {
      const err = await firestoreRes.text()
      console.error('\n❌ Firestore write failed:', err)

      // Rollback newly created Auth user
      if (isNewlyCreated && uid) {
        console.warn('⚠️ Rolling back newly created Firebase Auth account...')
        try {
          const deleteUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`
          await httpsRequest(deleteUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }, { localId: uid })
          console.warn('✓ Rollback complete: Deleted newly created Auth account.')
        } catch (delErr) {
          console.error('Rollback error:', delErr)
        }
      }
      process.exit(1)
    }

    console.log('✓ Firestore user document created with role: "admin" and verified: true.\n')
    console.log('======================================================')
    console.log('🎉 INITIAL ADMIN ACCOUNT CREATED SUCCESSFULLY!')
    console.log('======================================================')
    console.log(`Email:    ${email}`)
    console.log(`Name:     ${name}`)
    console.log(`Role:     admin`)
    console.log(`Verified: true`)
    console.log(`UID:      ${uid}`)
    console.log('======================================================\n')
    console.log('👉 To log in: Start the web app ("npm run dev"), click "Official Portal Login", and enter your admin credentials.\n')

    process.exit(0)
  } catch (err) {
    console.error('\n❌ [BOOTSTRAP ERROR]:', err.message || err)
    process.exit(1)
  }
}

bootstrapAdmin()
