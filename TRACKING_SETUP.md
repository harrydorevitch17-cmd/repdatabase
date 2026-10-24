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


## Shipping desk: maps, warehouse updates and flight schedules

The shipping desk at `/tracking.html` now uses `/shipping-desk.js`, `/shipping-desk.css`, `/lib/shipping-core.js` and locally hosted Leaflet. The earlier `/tracking.js` remains for compatibility with cached pages but is not loaded by the new page.

- Map locations use valid carrier event coordinates where supplied, or a conservative match against the bundled GeoNames city index. Ambiguous or unknown city names do not produce a guessed pin. A city-centre pin is labelled approximate. The route line connects reported scan positions; it is not GPS or confirmed aircraft routing.
- The basemap has a local Natural Earth fallback. Street detail loads standard OpenStreetMap tiles on demand after scans are mapped, with visible attribution and normal browser caching. No tiles are downloaded in bulk. See data/SOURCES.md and vendor/LEAFLET-LICENSE.txt for licences.
- KakoBuy account events are not available through the carrier API in general. A visitor can add the exact text, time, timezone and city from their parcel page. These updates remain only in the current tab and are labelled added by you. The code does not ask for KakoBuy passwords, scrape private accounts or invent warehouse departures.
- Progress markers light up only for stages described by events. Airline receipt is not shown as an airborne parcel, a shipping label is not shown as carrier collection, and a generic warehouse is not automatically attributed to KakoBuy.
- `/api/flights?airport=CAN` supports Aviationstack schedules when `AVIATIONSTACK_API_KEY` is present in Vercel. This is a separate provider account and entitlement from parcel tracking. No account purchase or paid subscription is created by the site. Enable a provider plan supporting the endpoint only after reviewing its current limits.
- Departures are requested only when the visitor presses Check upcoming departures. Results are cached for 10 minutes per server instance. The endpoint filters future departures, removes codeshares/duplicates and excludes cancelled or already-departed flights. Partial provider pages are labelled partial; the UI never claims complete coverage or links a parcel to an aircraft based on proximity alone.
- Airports come from OurAirports. Nearby scheduled-service airports within 150 km are offered; a nearby large airport is selected by default. This is reference geography, not a carrier-confirmed origin airport.
- A sample journey is available via an explicit button. All sample scans and flight rows are labelled illustrative; the sample never calls the tracking or flight provider. Real tracking and schedules never silently fall back to example data.
- `/api/tracking-config` reports only whether each provider key exists. It never returns the keys or guarantees that a key is valid.

Verification: `node --test tests/*.test.cjs`. Browser QA covers real map reference files and explicit fixture responses for providers. A real parcel test and real departure-board test remain required after provider credentials are available. Public API quotas need provider-side usage caps or Vercel Firewall controls beyond the per-instance protections in this source.
