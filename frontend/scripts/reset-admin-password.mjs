import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import crypto from 'node:crypto'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const defaultProjectId = 'civicpulse-ai-41cd1'

const sslAgent = new https.Agent({
  rejectUnauthorized: false,
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

function loadServiceAccount() {
  const keyPath = path.join(__dirname, '../serviceAccountKey.json')
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  }
  return null
}

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

function promptPassword(question) {
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

async function resetPassword() {
  console.log('\n======================================================')
  console.log('🔑 CivicPulse-AI: Admin Password Reset Tool')
  console.log('======================================================\n')

  try {
    const serviceAccount = loadServiceAccount()
    if (!serviceAccount) {
      console.error('❌ [ERROR] serviceAccountKey.json not found in frontend directory.')
      process.exit(1)
    }

    const projectId = serviceAccount.project_id || defaultProjectId
    const targetEmail = (process.argv[2] || 'admin@civicpulse.org').toLowerCase()
    let newPassword = process.argv[3]

    if (!newPassword) {
      newPassword = await promptPassword(`Enter new password for ${targetEmail} (min 8 chars): `)
    }

    if (!newPassword || newPassword.length < 8) {
      console.error('❌ Password must be at least 8 characters long.')
      process.exit(1)
    }

    console.log(`\n⏳ Authenticating with Google Cloud Identity Toolkit...`)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    // 1. Lookup user UID
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`
    const lookupRes = await httpsRequest(lookupUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    }, { email: [targetEmail] })

    const lookupData = await lookupRes.json()
    if (!lookupData.users || lookupData.users.length === 0) {
      console.error(`❌ User not found in Firebase Auth: ${targetEmail}`)
      process.exit(1)
    }

    const uid = lookupData.users[0].localId
    console.log(`✓ Located user account in Firebase Auth (UID: ${uid}).`)

    // 2. Update password
    const updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`
    const updateRes = await httpsRequest(updateUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    }, {
      localId: uid,
      password: newPassword
    })

    if (!updateRes.ok) {
      const err = await updateRes.text()
      throw new Error(`Failed to update password: ${err}`)
    }

    console.log(`✓ Password updated successfully in Firebase Authentication.`)

    // 3. Verify Firestore document
    console.log(`⏳ Verifying Firestore user profile...`)
    const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`
    const docRes = await httpsRequest(firestoreDocUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!docRes.ok) {
      const err = await docRes.text()
      throw new Error(`Failed to retrieve Firestore profile: ${err}`)
    }

    const docData = await docRes.json()
    const role = docData.fields?.role?.stringValue
    const verified = docData.fields?.verified?.booleanValue

    console.log('\n======================================================')
    console.log('✅ ADMIN ACCOUNT VERIFIED & PASSWORD RESET COMPLETE')
    console.log('======================================================')
    console.log(`Email:          ${targetEmail}`)
    console.log(`UID:            ${uid}`)
    console.log(`Firestore Role: ${role}`)
    console.log(`Verified:       ${verified}`)
    console.log('======================================================\n')

    if (role === 'admin' && verified === true) {
      console.log('✓ Confirmation: User profile retains full role: "admin" and verified: true.\n')
    } else {
      console.warn('⚠️ Warning: Profile fields differ from expected admin status.')
    }

    process.exit(0)
  } catch (err) {
    console.error('\n❌ [ERROR]:', err.message || err)
    process.exit(1)
  }
}

resetPassword()
