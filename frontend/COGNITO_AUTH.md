# Amazon Cognito Auth setup

> The proxy architecture below supersedes any older direct-browser/public-client wording in this
> document: use the confidential client and Render variables above. The browser must never call
> Cognito directly or receive `COGNITO_CLIENT_SECRET`.

The Render service uses an Amazon Cognito User Pool confidential app client. The browser talks
only to the same-origin Node auth proxy; the client secret, authorization-code exchange, direct
auth calls, tokens, and session state stay server-side. No Cognito client secret is sent to the browser.

1. Create or select an Amazon Cognito User Pool and enable email sign-in.
2. Assign a domain and retain the confidential app client with authorization-code grant.
3. Allow `openid email` scopes and set callback URL to `https://<render-host>/auth/callback` and logout URL to `https://<render-host>/Nexus/auth.html`.
4. In Render, set these server-only environment variables:

```text
COGNITO_DOMAIN=https://<domain>.auth.<region>.amazoncognito.com
COGNITO_CLIENT_ID=<confidential-app-client-id>
COGNITO_CLIENT_SECRET=<Render-secret>
COGNITO_REDIRECT_URI=https://<render-host>/auth/callback
COGNITO_LOGOUT_URI=https://<render-host>/Nexus/auth.html
COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
SESSION_SECRET=<long-random-Render-secret>
PORT=<Render-provided-port>
```

Never put a Cognito client secret or AWS credentials in source, browser code, or any `VITE_` variable.
The proxy fails closed with 503 when any required Render variable is absent. Render should use
the repository root as build context and the root Dockerfile; its start command is the Dockerfile
default (`node server.js`).

Implemented flows:

- Nexus-hosted multi-step sign-up at `signup.html` (name, contact, address, password, email code);
- on-page email/password sign-in via a server-side InitiateAuth call with `SECRET_HASH`;
- authorization-code exchange on the server with state and nonce checks;
- issuer, audience, token-use, and expiry checks before creating an opaque HttpOnly session;
- secure SameSite cookies and a public `/healthz` endpoint;
- sign-out that clears the server session and cookie.

## Sign-up (`signup.html`)

`cognito-api.js` calls same-origin `/api/auth/*` routes; the Node proxy calls the user-pool API using
app client id — `SignUp`, `ConfirmSignUp`, and `ResendConfirmationCode`, the three operations a
public client may call unauthenticated. There is no backend, no AWS credential, and no
`SecretHash`. The endpoint is derived from `VITE_COGNITO_ISSUER`, so it needs no extra variable.

The flow collects and submits these Cognito standard attributes:

| Field | Cognito attribute | Notes |
| --- | --- | --- |
| First name | `given_name` | |
| Last name | `family_name` | |
| Email | `email` + `Username` | Receives the verification code |
| Mobile number | `phone_number` | Normalised to E.164 before submission |
| Street, unit, city, region, postal code, country | `address` | Joined into the single OIDC `address.formatted` string |

After `ConfirmSignUp` succeeds, the page hands off to the normal PKCE sign-in with
`login_hint` set to the new email. The password is never persisted anywhere in the frontend.

### Confidential client boundary

This is the single hard requirement, and it is currently **not met** by app client
`67ajqh4655tvb6a6g74sdang7g`. Cognito reports:

```text
Client 67ajqh4655tvb6a6g74sdang7g is configured with secret but SECRET_HASH was not received
```

Every user-pool call from a browser — `SignUp`, `InitiateAuth`, and the hosted-UI
`/oauth2/token` exchange — must be authenticated with a `SECRET_HASH` (or HTTP Basic) derived
from the client secret when the app client has one. That secret cannot ship in a frontend
bundle, so **no browser-only flow can work against a client with a secret**, hosted UI included.

Fix: create a second app client of type *Public client* with **no** client secret, give it the
same callback/sign-out URLs and auth flows, and point `VITE_COGNITO_CLIENT_ID` at it. Keep the
existing confidential client for any server-side use.

### Required app-client configuration

The sign-up page cannot create or change AWS resources. The pool and app client must already
allow all of the following, or Cognito rejects `SignUp` and the page shows its error verbatim:

- **No client secret on the app client** (see above — this is currently blocking). A secret requires a `SecretHash`, which cannot
  be computed in a browser without shipping the secret.
- **`given_name`, `family_name`, `phone_number`, and `address` writable by the app client.**
  Under *App client → Attribute read and write permissions*. An attribute that is required by
  the pool but not writable by the client fails with `InvalidParameterException`.
- **Self-service sign-up enabled** on the pool.
- **Email as the sign-in identifier**, matching `Username: <email>`.

Widening `VITE_COGNITO_SCOPES` to include `profile`, `phone`, or `address` puts those claims in
the ID token, but each one must first be allowed on the app client. The default stays
`openid email` so an unchanged pool keeps working.

## Trust boundary

The static frontend guard is a user-experience boundary. Any API or server-side protected
operation must independently verify the access token's issuer, client ID, token use, expiry,
and JWKS signature; never trust browser storage alone.
