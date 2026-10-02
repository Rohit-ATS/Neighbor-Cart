import { isCognitoConfigured, persistSession } from './cognito.js';
import { confirmSignUp, formatAddress, resendCode, signIn, signUp, toE164 } from './cognito-api.js';

const form = document.querySelector('[data-form]');
const status = document.querySelector('[data-auth-status]');
const eyebrow = document.querySelector('[data-eyebrow]');
const title = document.querySelector('[data-title]');
const subtitle = document.querySelector('[data-subtitle]');
const back = document.querySelector('[data-back]');
const next = document.querySelector('[data-next]');
const resend = document.querySelector('[data-resend]');
const railItems = [...document.querySelectorAll('[data-rail] li')];
const steps = [...document.querySelectorAll('.onboard-step')];
const field = (name) => form.elements.namedItem(name);
const value = (name) => String(field(name)?.value || '').trim();

const copy = {
  1: { title: 'Let’s start with your name.', subtitle: 'This is the name that appears on your Nexus account and on money you send.' },
  2: { title: 'How can we reach you?', subtitle: 'We verify your email before the account opens, and your mobile secures it afterwards.' },
  3: { title: 'Where do you live?', subtitle: 'Regulated money accounts need a residential address on file. It stays private.' },
  4: { title: 'Secure your account.', subtitle: 'Pick a strong password, then check that everything below is right.' },
  5: { title: 'Check your email.', subtitle: 'We sent a 6-digit code. Enter it to finish opening your account.' },
};

/* The password rules Cognito pools enforce; the pool is the authority, so a
   rejection still surfaces Cognito's own message rather than this list. */
const rules = {
  length: (password) => password.length >= 12,
  upper: (password) => /[A-Z]/.test(password),
  lower: (password) => /[a-z]/.test(password),
  number: (password) => /\d/.test(password),
  symbol: (password) => /[^A-Za-z0-9]/.test(password),
};

let step = 1;
let busy = false;
/* Set once SignUp succeeds, so a failed confirmation retries confirmation
   instead of re-registering an account that already exists. */
let registered = false;

function show(message, kind = '') {
  status.hidden = !message;
  status.textContent = message;
  status.dataset.kind = kind;
}

function setError(name, message) {
  const target = document.querySelector(`[data-error-for="${name}"]`);
  if (target) { target.hidden = !message; target.textContent = message || ''; }
  const input = field(name);
  if (input && input.type !== 'checkbox') input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearErrors() {
  document.querySelectorAll('[data-error-for]').forEach((node) => { node.hidden = true; node.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((node) => node.setAttribute('aria-invalid', 'false'));
}

function render() {
  steps.forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
  railItems.forEach((item) => {
    const index = Number(item.dataset.railStep);
    item.toggleAttribute('data-done', index < step);
    item.toggleAttribute('data-current', index === step);
  });
  eyebrow.textContent = `Step ${step} of 5`;
  title.textContent = copy[step].title;
  subtitle.textContent = copy[step].subtitle;
  back.hidden = step === 1 || step === 5;
  next.textContent = step === 4 ? 'Create account' : step === 5 ? 'Finish' : 'Continue';
  if (step === 4) updateReview();
  const first = steps.find((node) => Number(node.dataset.step) === step)?.querySelector('input:not([type="checkbox"]), select');
  first?.focus({ preventScroll: true });
}

function setBusy(state, label) {
  busy = state;
  next.disabled = state;
  back.disabled = state;
  if (resend) resend.disabled = state;
  next.textContent = state ? label : (step === 4 ? 'Create account' : step === 5 ? 'Finish' : 'Continue');
}

/* ---------- Validation ---------- */
function validate() {
  clearErrors();
  const problems = [];
  const require = (name, message) => { if (!value(name)) { setError(name, message); problems.push(name); } };

  if (step === 1) {
    require('firstName', 'Enter your first name.');
    require('lastName', 'Enter your last name.');
  }

  if (step === 2) {
    const email = value('email');
    if (!email) { setError('email', 'Enter your email address.'); problems.push('email'); }
    /* Deliberately permissive: Cognito is the authority on deliverability, and an
       over-strict pattern locks out valid addresses. */
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('email', 'That does not look like a complete email address.'); problems.push('email'); }
    const phone = value('phone');
    if (!phone) { setError('phone', 'Enter your mobile number.'); problems.push('phone'); }
    else if (!toE164(phone, value('phoneCountry'))) { setError('phone', 'Enter a full mobile number, digits only or with spaces and dashes.'); problems.push('phone'); }
  }

  if (step === 3) {
    require('line1', 'Enter your street address.');
    require('city', 'Enter your city.');
    require('region', 'Enter your state or region.');
    require('postalCode', 'Enter your ZIP or postal code.');
    require('country', 'Enter your country.');
  }

  if (step === 4) {
    const password = String(field('password').value);
    const unmet = Object.entries(rules).filter(([, test]) => !test(password));
    if (!password) { setError('password', 'Choose a password.'); problems.push('password'); }
    else if (unmet.length) { setError('password', 'Your password does not meet all the requirements below yet.'); problems.push('password'); }
    if (String(field('confirmPassword').value) !== password) { setError('confirmPassword', 'Both passwords must match.'); problems.push('confirmPassword'); }
    if (!field('terms').checked) { setError('terms', 'Please accept the terms to continue.'); problems.push('terms'); }
  }

  if (step === 5) {
    const code = value('code');
    if (!/^\d{6}$/.test(code)) { setError('code', 'Enter the 6-digit code from your email.'); problems.push('code'); }
  }

  if (problems.length) {
    show('Please fix the highlighted fields.', 'error');
    field(problems[0])?.focus();
    return false;
  }
  show('');
  return true;
}

/* ---------- Review summary ---------- */
function addressFromForm() {
  return formatAddress({ line1: value('line1'), line2: value('line2'), city: value('city'), region: value('region'), postalCode: value('postalCode'), country: value('country') });
}

function updateReview() {
  document.querySelector('[data-review-name]').textContent = [value('firstName'), value('lastName')].filter(Boolean).join(' ') || '—';
  document.querySelector('[data-review-email]').textContent = value('email') || '—';
  document.querySelector('[data-review-phone]').textContent = toE164(value('phone'), value('phoneCountry')) || value('phone') || '—';
  document.querySelector('[data-review-address]').textContent = addressFromForm() || '—';
}

/* ---------- Password meter ---------- */
const strength = document.querySelector('[data-strength]');
const strengthFill = document.querySelector('[data-strength-fill]');
const strengthLabel = document.querySelector('[data-strength-label]');
const labels = { 0: 'Too short', 1: 'Weak', 2: 'Fair', 3: 'Strong', 4: 'Very strong' };

field('password')?.addEventListener('input', (event) => {
  const password = String(event.target.value);
  const met = Object.entries(rules).filter(([, test]) => test(password)).length;
  document.querySelectorAll('[data-checklist] li').forEach((item) => {
    item.toggleAttribute('data-met', rules[item.dataset.rule](password));
  });
  strength.hidden = !password;
  /* Five satisfied rules collapse onto a four-step bar. */
  const level = Math.min(4, Math.max(0, met - 1));
  strength.dataset.level = String(level);
  strengthFill.style.width = `${(met / 5) * 100}%`;
  strengthLabel.textContent = labels[level];
});

/* ---------- Submission ---------- */
async function register() {
  const email = value('email');
  setBusy(true, 'Creating account…');
  try {
    const { confirmed, deliveryTo } = await signUp({
      email,
      password: String(field('password').value),
      firstName: value('firstName'),
      lastName: value('lastName'),
      phone: toE164(value('phone'), value('phoneCountry')),
      address: addressFromForm(),
    });
    registered = true;
    if (confirmed) { await handoff(email, 'Your account is ready. Taking you to sign-in…'); return; }
    step = 5;
    render();
    document.querySelector('[data-delivery]').textContent = deliveryTo
      ? `We emailed a code to ${deliveryTo}. It expires in 24 hours.`
      : 'Enter the code we emailed you. It expires in 24 hours.';
    show('Account created. Check your email for the verification code.', 'success');
  } catch (error) {
    show(error.message, 'error');
    if (error.code === 'UsernameExistsException') { step = 2; render(); setError('email', 'This email is already registered.'); }
    if (error.code === 'InvalidPasswordException') setError('password', error.message);
  } finally {
    setBusy(false);
  }
}

async function verify() {
  const email = value('email');
  setBusy(true, 'Verifying…');
  try {
    await confirmSignUp({ email, code: value('code') });
    await handoff(email, 'Verified. Taking you to sign-in…');
  } catch (error) {
    show(error.message, 'error');
    setError('code', error.code === 'CodeMismatchException' || error.code === 'ExpiredCodeException' ? error.message : '');
  } finally {
    setBusy(false);
  }
}

/* Sign the new account in on this page — no redirect to a hosted screen. The password is
   read straight from the form and dropped with form.reset() as soon as tokens come back. */
async function handoff(email, message) {
  show(message, 'success');
  const password = String(field('password').value);
  try {
    const tokens = await signIn({ email, password });
    await persistSession(tokens);
    form.reset();
    window.location.replace('./dashboard.html');
  } catch (error) {
    form.reset();
    /* The account exists and is confirmed; only the automatic sign-in failed. */
    show(`Your account is ready, but automatic sign-in failed: ${error.message} Please sign in.`, 'error');
    setTimeout(() => window.location.replace('./auth.html'), 2500);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !validate()) return;
  if (step === 4) {
    /* A retry after a failed confirmation must not call SignUp twice. */
    if (registered) { step = 5; render(); show('This account is already created. Enter your verification code.'); }
    else await register();
    return;
  }
  if (step === 5) { await verify(); return; }
  step += 1;
  render();
});

back.addEventListener('click', () => { if (busy || step === 1) return; show(''); clearErrors(); step -= 1; render(); });

document.querySelector('[data-goto]')?.addEventListener('click', (event) => {
  if (busy) return;
  show(''); clearErrors();
  step = Number(event.currentTarget.dataset.goto);
  render();
});

resend?.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true, 'Sending…');
  try {
    const { deliveryTo } = await resendCode({ email: value('email') });
    show(deliveryTo ? `New code sent to ${deliveryTo}.` : 'New code sent.', 'success');
  } catch (error) {
    show(error.message, 'error');
  } finally {
    setBusy(false);
  }
});

/* Clear a field's error as soon as the person starts correcting it. */
form.addEventListener('input', (event) => {
  const name = event.target.name;
  if (name) setError(name, '');
});

render();

if (!isCognitoConfigured) {
  show('Sign-up is unavailable: configure the server Cognito variables in Render.', 'error');
  next.disabled = true;
  back.disabled = true;
  if (resend) resend.disabled = true;
}
