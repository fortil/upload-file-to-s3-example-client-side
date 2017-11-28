import moment from 'moment'
import crypto from 'crypto'

const accessKey = 'accessKey'
const secret = 'secret-key'
const REGION = 'region-name'
const REQUESTTYPE = 'aws4_request'
const BUCKET = 'bucket-name'
const SERVICE = 's3'
const FILE_UPLOAD_S3_PATH = `https://s3.${REGION}.amazonaws.com/${BUCKET}`

function policyBase64(now, credential, key) {
  const expiration = now.add(60, 'minutes').format('YYYY-MM-DD[T]HH:MM:SS[Z]')
  const policy = {
    'expiration': expiration,
    'conditions': [
      { bucket: BUCKET },
      { key: key },
      { acl: 'public-read' },
      [ 'starts-with', '$Content-Type', '' ],
      {'x-amz-server-side-encryption': 'AES256'},
      {'x-amz-credential': credential},
      {'x-amz-algorithm': 'AWS4-HMAC-SHA256'},
      {'x-amz-date': expandedDate(now)}
    ]
  }
  return Buffer.from(JSON.stringify(policy)).toString('base64')
}

function generateSigningKey(secret, now, region = REGION, service = SERVICE, requestType = REQUESTTYPE) {
  const date = now.format('YYYYMMDD')
  const kDate = crypto.createHmac('sha256', 'AWS4' + secret).update(date).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest()

  return crypto.createHmac('sha256', kService).update(requestType)
}

function generateSignature(signingKey, stringToSign) {
  return crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')
}

function expandedDate(now) {
  return now.format('YYYYMMDD[T]HHMMSS[Z]')
}

function s3credentials(fileKey) {
  const now = moment.utc()
  const credential = [accessKey, now.format('YYYYMMDD'), REGION, SERVICE, REQUESTTYPE].join('/')
  const policy = policyBase64(now, credential, fileKey)
  const signingKey = generateSigningKey(secret, now, REGION, SERVICE, REQUESTTYPE)
  const signature = generateSignature(signingKey.digest(), policy)

  return {
    key: fileKey,
    acl: 'public-read',
    policy,
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-credential': credential,
    'x-amz-date': expandedDate(now),
    'x-amz-signature': signature
  }
}

export default function uploadFileToS3(file) {
  const fileName = file.name
  const fileKey = `forlder-to-upload/${fileName}`
  const formData = new FormData({})
  const credentials = s3credentials(fileKey)
  const headers = new Headers()

  formData.append('key', fileKey)
  formData.append('acl', 'public-read')
  formData.append('x-amz-server-side-encryption', 'AES256')
  formData.append('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')

  formData.append('X-Amz-Credential', credentials['x-amz-credential'])
  formData.append('X-Amz-Date', credentials['x-amz-date'])
  formData.append('Policy', credentials['policy'])
  formData.append('X-Amz-Signature', credentials['x-amz-signature'])
  formData.append('Content-Type', file.type)
  formData.append('file', file)

  headers.append('Cache-Control', 'max-age=0')
  headers.append('mimeType', file.type)
  headers.append('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
  headers.append('Upgrade-Insecure-Requests', '1')

  return fetch(FILE_UPLOAD_S3_PATH, {
    method: 'POST',
    body: formData,
    headers
  }).then((resp) => {
    if (resp.status >= 200 && resp.status < 205) {
      return `https://${BUCKET}/${fileKey}`
    } else {
      return false
    }
  })
}
