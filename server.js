import { createServer } from 'node:http';
import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'frontend', 'dist');
const port = Number(process.env.PORT || 8080);
const config = {
  domain: process.env.COGNITO_DOMAIN?.replace(/\/$/, ''),
  issuer: process.env.COGNITO_ISSUER?.replace(/\/$/, ''),
  clientId: process.env.COGNITO_CLIENT_ID,
  clientSecret: process.env.COGNITO_CLIENT_SECRET,
  redirectUri: process.env.COGNITO_REDIRECT_URI,
  logoutUri: process.env.COGNITO_LOGOUT_URI,
  sessionSecret: process.env.SESSION_SECRET,
};
const ready = Object.values(config).every(Boolean);
const sessions = new Map();
const cookie = (name, value, maxAge = 3600) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const clearCookie = (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
const sign = (value) => createHmac('sha256', config.sessionSecret || 'unconfigured').update(value).digest('base64url');
function validSigned(value) {
  const [raw, mac] = String(value || '').split('.');
  if (!raw || !mac) return '';
  const expected = sign(raw);
  return mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? raw : '';
}
function cookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map((part) => part.trim().split('=')));
}
function json(response, status, body, headers = {}) { response.writeHead(status, { 'Content-Type': 'application/json', ...headers }); response.end(JSON.stringify(body)); }
async function body(request) { let text = ''; for await (const chunk of request) text += chunk; return text ? JSON.parse(text) : {}; }
async function cognito(target, payload) {
  if (!ready) throw new Error('Authentication service is not configured.');
  const response = await fetch(`${config.issuer}/`, { method: 'POST', headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` }, body: JSON.stringify({ ClientId: config.clientId, ...payload }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(result.message || `Cognito rejected the request (${response.status}).`); error.code = String(result.__type || '').split('#').pop(); throw error; }
  return result;
}
function claims(token) { const parts = String(token || '').split('.'); if (parts.length !== 3) throw new Error('Malformed ID token.'); return { header: JSON.parse(Buffer.from(parts[0], 'base64url')), payload: JSON.parse(Buffer.from(parts[1], 'base64url')), signature: Buffer.from(parts[2], 'base64url'), input: `${parts[0]}.${parts[1]}` }; }
async function validateIdToken(token, expectedNonce = '') {
  const { header, payload, signature, input } = claims(token);
  if (header.alg !== 'RS256' || !header.kid || payload.iss !== config.issuer || payload.aud !== config.clientId || payload.token_use !== 'id' || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000) || (expectedNonce && payload.nonce !== expectedNonce)) throw new Error('Invalid Cognito ID token.');
  const jwks = await fetch(`${config.issuer}/.well-known/jwks.json`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Cognito JWKS request failed.')));
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk || !verifySignature('RSA-SHA256', Buffer.from(input), createPublicKey({ key: jwk, format: 'jwk' }), signature)) throw new Error('Invalid Cognito ID token signature.');
  return payload;
}
function session(response, tokens) {
  const id = randomBytes(32).toString('base64url');
  sessions.set(id, { ...tokens, claims: tokens.claims, expires: Date.now() + ((tokens.expires_in || 3600) * 1000) });
  response.setHeader('Set-Cookie', cookie('nexus_session', `${id}.${sign(id)}`));
}
function current(request) { const id = validSigned(cookies(request).nexus_session); const value = sessions.get(id); if (!value || value.expires < Date.now()) { sessions.delete(id); return null; } return value; }
async function apiAuth(request, response, route) {
  const input = await body(request);
  const hash = (username) => createHmac('sha256', config.clientSecret).update(`${username}${config.clientId}`).digest('base64');
  if (route === 'signin') {
    const result = await cognito('InitiateAuth', { AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: input.email, PASSWORD: input.password, SECRET_HASH: hash(input.email) } });
    if (!result.AuthenticationResult?.IdToken) throw new Error('Cognito did not return a session.');
    const token = result.AuthenticationResult.IdToken;
    session(response, { claims: await validateIdToken(token), expires_in: result.AuthenticationResult.ExpiresIn });
    return json(response, 200, { authenticated: true });
  }
  if (route === 'signup') return json(response, 200, await cognito('SignUp', { Username: input.email, Password: input.password, SecretHash: hash(input.email), UserAttributes: input.attributes }));
  if (route === 'confirm') return json(response, 200, await cognito('ConfirmSignUp', { Username: input.email, ConfirmationCode: input.code, SecretHash: hash(input.email) }));
  if (route === 'resend') return json(response, 200, await cognito('ResendConfirmationCode', { Username: input.email, SecretHash: hash(input.email) }));
  return json(response, 404, { error: 'Not found' });
}
async function staticFile(response, pathname) {
  let relative = pathname === '/Nexus/' ? '/index.html' : pathname.replace(/^\/Nexus/, '') || '/index.html';
  const file = normalize(join(publicRoot, relative));
  if (!file.startsWith(publicRoot + sep)) return json(response, 400, { error: 'Bad path' });
  try { const info = await stat(file); if (!info.isFile()) throw new Error(); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' }; response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); response.end(await readFile(file)); } catch { json(response, 404, { error: 'Not found' }); }
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/healthz') return json(response, 200, { status: 'ok', authConfigured: ready });
    if (url.pathname === '/auth/login') { if (!ready) return json(response, 503, { error: 'Authentication is not configured.' }); const state = randomBytes(32).toString('base64url'); const nonce = randomBytes(32).toString('base64url'); response.setHeader('Set-Cookie', cookie('nexus_oauth_state', `${state}.${nonce}.${sign(`${state}.${nonce}`)}`, 600)); return response.writeHead(302, { Location: `${config.domain}/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, scope: 'openid email', state, nonce })}` }).end(); }
    if (url.pathname === '/auth/callback') { const stored = cookies(request).nexus_oauth_state?.split('.'); if (!stored || stored[0] !== url.searchParams.get('state') || stored[2] !== sign(`${stored[0]}.${stored[1]}`)) return json(response, 400, { error: 'Invalid login state.' }); const token = await fetch(`${config.domain}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, code: url.searchParams.get('code'), redirect_uri: config.redirectUri }) }).then((r) => r.json()); session(response, { claims: await validateIdToken(token.id_token, stored[1]), expires_in: token.expires_in }); response.setHeader('Set-Cookie', [response.getHeader('Set-Cookie'), clearCookie('nexus_oauth_state')]); return response.writeHead(302, { Location: '/Nexus/dashboard.html' }).end(); }
    if (url.pathname === '/auth/logout') { const id = validSigned(cookies(request).nexus_session); sessions.delete(id); response.setHeader('Set-Cookie', clearCookie('nexus_session')); return response.writeHead(302, { Location: '/Nexus/auth.html' }).end(); }
    if (url.pathname === '/api/session') { const value = current(request); return json(response, 200, value ? { authenticated: true, user: value.claims } : { authenticated: false }); }
    if (url.pathname.startsWith('/api/auth/') && request.method === 'POST') return await apiAuth(request, response, url.pathname.slice('/api/auth/'.length));
    if (url.pathname === '/') return response.writeHead(302, { Location: '/Nexus/' }).end();
    if (url.pathname.startsWith('/Nexus/')) return staticFile(response, url.pathname);
    return json(response, 404, { error: 'Not found' });
  } catch (error) { return json(response, error.code ? 400 : 503, { error: error.message, code: error.code || 'AuthUnavailable' }); }
});
server.listen(port, '0.0.0.0', () => console.log(`Nexus auth proxy listening on ${port}`));
