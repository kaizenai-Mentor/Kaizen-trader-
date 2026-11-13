# Google sign-in setup

Google sign-in requires a Google OAuth web client. A missing client ID, client secret, or invalid callback configuration results in a visible message on the login or registration page. Email and password remain available.

1. In Google Cloud, configure the OAuth consent screen and create a **Web application** OAuth client. If the consent screen is in testing mode, add the Google accounts that will test it.
2. Add the exact authorized redirect URI for each environment to that client. For example:
   - Termux on the same phone: `http://localhost:3000/auth/google/callback`
   - Production: `https://kaizen-trader.onrender.com/auth/google/callback` (or the actual public site origin followed by `/auth/google/callback`)
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the environment for that deployment. Set `GOOGLE_CALLBACK_URL` to its exact authorized redirect URI. Do not put secrets in source control or share them in chat.
4. Restart KAIZEN. Open the site using the same origin as the callback, then try Continue with Google. The configured database must be available.

`GOOGLE_CALLBACK_URL` takes precedence. If omitted, the callback uses `APP_URL` plus `/auth/google/callback`; without `APP_URL`, it defaults to localhost in development and the Render site in production. Callback URLs must use HTTPS, except for localhost. A Google `redirect_uri_mismatch` means the configured URI must exactly match an authorized URI in Google Cloud, including scheme, host, port and path.

The project cannot provision or validate the Google client on its own. A real sign-in must be tested with the deployment's configured Google client and consent screen.
