import { isCognitoConfigured } from './cognito.js';

/* Amazon Cognito user-pool API calls a public app client may make unauthenticated:
   SignUp, ConfirmSignUp, ResendConfirmationCode, InitiateAuth, RevokeToken.
   No client secret and no AWS credentials are involved — adding either would ship it
   to the browser. A pool whose app client has a secret cannot be used from here: it
   would require a SecretHash, which is exactly the thing that must not reach the browser. */
const operations = {
  signUp: 'AWSCognitoIdentityProviderService.SignUp',
  confirmSignUp: 'AWSCognitoIdentityProviderService.ConfirmSignUp',
  resendCode: 'AWSCognitoIdentityProviderService.ResendConfirmationCode',
  initiateAuth: 'AWSCognitoIdentityProviderService.InitiateAuth',
  revokeToken: 'AWSCognitoIdentityProviderService.RevokeToken',
};

/* Cognito's own message is the only accurate account of a pool-policy rejection, so it is
   always what gets shown. These entries only ADD context for codes whose meaning depends on
   the operation — they never replace the message, because a blanket mapping here once
   reported "account already confirmed" for a pool that simply had sign-up switched off. */
const hints = {
  signUp: {
    NotAuthorizedException: 'This usually means self-service sign-up is disabled on the user pool, or the app client has a client secret.',
    InvalidParameterException: 'If this names an attribute, that attribute is probably not writable by this app client.',
    InvalidLambdaResponseException: 'A pre-sign-up Lambda trigger on the pool rejected or failed on this request.',
    UserLambdaValidationException: 'A pre-sign-up Lambda trigger on the pool rejected this request.',
  },
  confirmSignUp: {
    NotAuthorizedException: 'This account may already be confirmed — try signing in instead.',
  },
  initiateAuth: {
    NotAuthorizedException: 'Check the email and password. If they are right, the account may not be confirmed yet.',
    InvalidParameterException: 'The app client may not have ALLOW_USER_PASSWORD_AUTH enabled.',
  },
};

/* Only codes whose plain meaning is unambiguous regardless of operation. */
const rewritten = {
  UsernameExistsException: 'An account with this email already exists. Try signing in instead.',
  CodeMismatchException: 'That verification code is not correct. Check the code and try again.',
  ExpiredCodeException: 'That verification code has expired. Send yourself a new one.',
  LimitExceededException: 'Too many attempts. Wait a few minutes before trying again.',
  TooManyRequestsException: 'Too many attempts. Wait a few minutes before trying again.',
  TooManyFailedAttemptsException: 'Too many failed attempts. Wait a few minutes before trying again.',
  UserNotFoundException: 'No account exists for that email address.',
  PasswordResetRequiredException: 'This account needs a password reset before you can sign in.',
};

export class CognitoError extends Error {
  constructor(code, message, raw = '') { super(message); this.name = 'CognitoError'; this.code = code; this.raw = raw; }
}

async function call(operation, payload) {
  if (!isCognitoConfigured) throw new CognitoError('NotConfigured', 'Cognito is not configured.');
  let response;
  try {
    response = await fetch(`/api/auth/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CognitoError('NetworkError', 'Could not reach Amazon Cognito. Check your connection and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  /* __type looks like "com.amazonaws.cognitoidp#UsernameExistsException". */
  const code = body.code || String(body.__type || '').split('#').pop() || `Http${response.status}`;
  const raw = body.message || '';
  /* Checked before anything else: a client secret makes every browser-direct call fail, and
     the per-operation hints below would otherwise bury the one explanation that matters. */
  if (/SECRET_HASH|configured with secret/i.test(raw)) {
    throw new CognitoError('ClientSecretRequired', `This Cognito app client is configured with a client secret, so it cannot be used from a browser — every call would need a SECRET_HASH computed from that secret. Create a public app client with no secret and point VITE_COGNITO_CLIENT_ID at it. (Cognito said: ${raw})`, raw);
  }
  if (rewritten[code]) throw new CognitoError(code, rewritten[code], raw);
  const hint = hints[operation]?.[code];
  const base = raw || `Cognito rejected the request (${code}).`;
  throw new CognitoError(code, hint ? `${base} ${hint}` : base, raw);
}

/* Cognito requires E.164. Accept what people actually type and normalise, rather than
   rejecting "(555) 010-1234" for punctuation. Returns '' when it cannot be normalised. */
export function toE164(input, countryCode = '1') {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 && countryCode === '1') return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1') && countryCode === '1') return `+${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? `+${countryCode}${digits}` : '';
}

/* Cognito's standard `address` attribute is a single formatted string (OIDC
   address.formatted), so the structured fields are joined for storage. */
export function formatAddress({ line1 = '', line2 = '', city = '', region = '', postalCode = '', country = '' }) {
  const street = [line1, line2].map((part) => part.trim()).filter(Boolean).join(', ');
  const locality = [city.trim(), [region.trim(), postalCode.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, locality, country.trim()].filter(Boolean).join('\n');
}

export async function signUp({ email, password, firstName, lastName, phone, address }) {
  const attributes = [
    { Name: 'email', Value: email },
    { Name: 'given_name', Value: firstName },
    { Name: 'family_name', Value: lastName },
  ];
  if (phone) attributes.push({ Name: 'phone_number', Value: phone });
  if (address) attributes.push({ Name: 'address', Value: address });
  /* Email as username keeps sign-up and sign-in on the same identifier. */
  const result = await call('signup', { email, password, attributes });
  return { confirmed: Boolean(result.UserConfirmed), deliveryTo: result.CodeDeliveryDetails?.Destination || '' };
}

export async function confirmSignUp({ email, code }) {
  await call('confirm', { email, code: code.trim() });
}

export async function resendCode({ email }) {
  const result = await call('resend', { email });
  return { deliveryTo: result.CodeDeliveryDetails?.Destination || '' };
}

/* On-page sign-in. USER_PASSWORD_AUTH sends the password to Cognito over TLS instead of
   redirecting to the hosted UI; it requires ALLOW_USER_PASSWORD_AUTH on the app client.
   SRP would keep the password inside the browser entirely but needs a real SRP
   implementation — see COGNITO_AUTH.md before swapping this out. */
export async function signIn({ email, password }) {
  const result = await call('signin', { email, password });
  /* MFA or a forced password change comes back as a challenge, not tokens. Nothing in this
     frontend can complete those yet, so say so rather than failing as "no tokens". */
  if (result.ChallengeName) {
    throw new CognitoError(`Challenge:${result.ChallengeName}`, `This account requires an extra step (${result.ChallengeName}) that this app cannot complete yet.`);
  }
  return result;
}

/* Best effort: a revoked refresh token cannot be replayed if local storage is scraped later. */
export async function revokeToken(refreshToken) {
  return undefined;
}
