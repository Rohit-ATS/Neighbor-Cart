const required = {
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI,
  issuer: import.meta.env.VITE_COGNITO_ISSUER,
};

/* Public builds never receive the confidential client secret. Availability is determined
   by the same-origin proxy, which fails closed when Render secrets are absent. */
export const isCognitoConfigured = true;
export const cognitoClientId = required.clientId;
/* Allowed OIDC scopes are an app-client setting. Keep the default to what the pool
   already grants; widen it with VITE_COGNITO_SCOPES only after allowing the extra
   scopes on the app client, or /oauth2/authorize rejects the request. */
export const cognitoScopes = (import.meta.env.VITE_COGNITO_SCOPES || 'openid email').trim();
const sessionKey = 'nexus-cognito-session';
const verifierKey = 'nexus-cognito-pkce-verifier';
const stateKey = 'nexus-cognito-pkce-state';
const nonceKey = 'nexus-cognito-nonce';
const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (length = 64) => base64url(crypto.getRandomValues(new Uint8Array(length)));
async function challenge(verifier) { return base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))); }
function endpoint(path) { return `${required.domain.replace(/\/$/, '')}${path}`; }
/* The user-pool API shares an origin with the issuer: https://cognito-idp.<region>.amazonaws.com */
export function idpOrigin() {
  if (!required.issuer) throw new Error('Cognito is not configured.');
  return new URL(required.issuer).origin;
}
function clearPkce() { sessionStorage.removeItem(verifierKey); sessionStorage.removeItem(stateKey); sessionStorage.removeItem(nonceKey); }

export async function startLogin({ signup = false, loginHint = '' } = {}) {
  const query = signup ? '?signup=1' : '';
  window.location.assign(`/auth/login${query}`);
}

export async function finishLogin() {
  return getSession();
}

function decode(token) {
  const parts = token?.split('.'); if (parts?.length !== 3) throw new Error('Malformed Cognito ID token.');
  const decodePart = (part) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '=='), (char) => char.charCodeAt(0));
  return { header: JSON.parse(new TextDecoder().decode(decodePart(parts[0]))), claims: JSON.parse(new TextDecoder().decode(decodePart(parts[1]))), signature: decodePart(parts[2]), signingInput: `${parts[0]}.${parts[1]}` };
}
export async function validateIdToken(token, { nonce = '' } = {}) {
  const { header, claims, signature, signingInput } = decode(token);
  if (claims.iss !== required.issuer || claims.aud !== required.clientId || claims.token_use !== 'id' || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('Cognito ID token claims are invalid.');
  /* Only checked on the exchange that minted the nonce; a stored session re-check has none. */
  if (nonce && claims.nonce !== nonce) throw new Error('Cognito ID token nonce does not match.');
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Cognito ID token algorithm is invalid.');
  const keys = await fetch(`${required.issuer.replace(/\/$/, '')}/.well-known/jwks.json`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Cognito JWKS request failed.')));
  const jwk = keys.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('Cognito signing key is unknown.');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, new TextEncoder().encode(signingInput))) throw new Error('Cognito ID token signature is invalid.');
  return claims;
}
export async function getSession() {
  try { const response = await fetch('/api/session', { credentials: 'same-origin' }); if (!response.ok) return null; const result = await response.json(); return result.authenticated ? result : null; }
  catch { return null; }
}
export function readStoredSession() { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } }

/* Used by the on-page sign-in path, which gets tokens straight from InitiateAuth rather
   than from a redirect. The ID token is verified here too, so no caller can store an
   unvalidated session. */
export async function persistSession(tokens) {
  return getSession();
}

/* Sign-in happens on our own pages, so there is no hosted-UI cookie to clear and logout
   stays in the app. Callers should revoke the refresh token first (see revokeToken in
   cognito-api.js); dropping the local session is what ends access here.
   hostedLogoutUrl remains available if the hosted screens are ever reintroduced. */
export function hostedLogoutUrl() {
  return `${endpoint('/logout')}?${new URLSearchParams({ client_id: required.clientId, logout_uri: required.logoutUri })}`;
}
export function signOut({ redirectTo = './auth.html' } = {}) {
  window.location.replace('/auth/logout');
}
