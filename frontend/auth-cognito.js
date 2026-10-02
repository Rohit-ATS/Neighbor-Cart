import { finishLogin, isCognitoConfigured, persistSession } from './cognito.js';
import { signIn } from './cognito-api.js';

const status = document.querySelector('[data-auth-status]');
const form = document.querySelector('[data-login-form]');
const button = document.querySelector('[data-login]');
const signupLink = document.querySelector('[data-signup-link]');
const setup = 'Configure the server COGNITO_* variables and SESSION_SECRET in Render.';
const field = (name) => form.elements.namedItem(name);

function show(message, kind = '') { status.hidden = !message; status.textContent = message; status.dataset.kind = kind; }

function setError(name, message) {
  const target = document.querySelector(`[data-error-for="${name}"]`);
  if (target) { target.hidden = !message; target.textContent = message || ''; }
  field(name)?.setAttribute('aria-invalid', message ? 'true' : 'false');
}

if (!isCognitoConfigured) {
  show(`Authentication is unavailable. ${setup}`, 'error');
  button.disabled = true;
  [...form.elements].forEach((element) => { element.disabled = true; });
  /* An anchor cannot be disabled; remove the destination and mark it for styling. */
  signupLink?.removeAttribute('href');
  signupLink?.setAttribute('aria-disabled', 'true');
} else {
  /* Still handles a return from the hosted screens if one is ever reintroduced, and
     surfaces a session that is already valid. */
  finishLogin()
    .then((session) => { if (session) window.location.replace('./dashboard.html'); })
    .catch((error) => show(error.message, 'error'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('email', ''); setError('password', ''); show('');
    const email = String(field('email').value).trim();
    const password = String(field('password').value);
    if (!email) { setError('email', 'Enter your email address.'); field('email').focus(); return; }
    if (!password) { setError('password', 'Enter your password.'); field('password').focus(); return; }

    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const tokens = await signIn({ email, password });
      await persistSession(tokens);
      /* replace, not assign: the signed-in page must not be reachable with Back. */
      window.location.replace('./dashboard.html');
    } catch (error) {
      show(error.message, 'error');
      field('password').value = '';
      field('password').focus();
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  form.addEventListener('input', (event) => { if (event.target.name) setError(event.target.name, ''); });
}
