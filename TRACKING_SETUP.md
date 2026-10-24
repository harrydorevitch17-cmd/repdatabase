# Live parcel tracking setup

The native tracker calls `/api/track`, a Vercel Node function using the 17TRACK v2.4 API. The browser never receives the API key. No paid subscription is created by this code.

## Account and deployment

1. Create or sign in to an account at https://api.17track.net.
2. Open https://api.17track.net/admin/settings and obtain the Security Key.
3. In the Vercel project serving repdatabase.store, open Settings > Environment Variables.
4. Add `TRACKING_API_KEY` with the Security Key as its value. Select Production. Select Preview only if you intend to test in preview deployments too.
5. Deploy this source after saving the environment variable. Environment changes require a new deployment.
6. Track a real shipment from the website. Confirm the returned carrier and compare the latest scan timestamp against that carrier's portal.

Do not put the Security Key into HTML, JavaScript sent to the browser, a chat message, or Git. `.env.example` contains the variable name only. If the account requires webhook setup or has an IP restriction, complete the required provider account settings before enabling tracking; provider setup errors are reported without leaking credentials.

## Cost and freshness

17TRACK documents a one-time allowance of 200 tracking numbers for new API accounts registered after 7 January 2026. This is not an ongoing free allowance. Check the account's current entitlement and remaining quota before launch. There is no automatic quota purchase in this implementation.

The endpoint first retrieves a number already registered in your account. A new number is registered only when the provider says it is not registered. The site uses `gettrackinfo`, which returns the provider's latest collected carrier data. It does not call the separately charged instant real-time endpoint. New registrations can require a wait before the first scan appears. Provider sync time, scan time, and lookup time are distinct in the UI.

The public lookup accepts automatic carrier detection or an optional carrier selected by the visitor. Multiple carrier matches remain separate until the visitor chooses one; results from unrelated matches are not combined. Numbers requiring private recipient verification are reported clearly, rather than guessed.

## Verification

Run `node --test tests/tracking-api.test.cjs` with Node 22 or later. Tests use explicit fixtures, not real quota. Browser QA fixtures are development-only and are not part of the deployed site.

The endpoint applies a best-effort per-instance request limit. Use Vercel Firewall rate limiting for durable protection across server instances before opening a limited trial quota to heavy traffic. Tracking responses use private, no-store caching, and do not expose recipient addresses or contact details.

Official references:
- https://api.17track.net/en/doc
- https://vercel.com/docs/environment-variables/managing-environment-variables
