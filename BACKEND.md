Backend behaviour
=================

GET /api/catalogue reads all product pages using the anonymous read role. It never writes products. Requests that arrive together share one read; a successful result is cached in the function for 15 seconds. Responses include an ETag for conditional GET/HEAD requests.

If the database fails, the endpoint returns its last successful catalogue for up to five minutes, then uses the bundled data/catalogue.json snapshot. X-Catalogue-Source identifies live, stale, or snapshot data. A failed later page never returns a partial catalogue.

Admin writes use the signed-in user's session and database row-level policies. The verified owner's account is allowed to add, edit and delete products and upload/delete catalogue images. Other accounts retain public read access. Adding another editor requires an explicit policy change. No password is stored in this repository.

The migration under supabase/migrations also removes the unused public analytics insert path and limits historical event reads to the owner. SQL policy tests were run in a rolled-back transaction; no products were changed by those tests.

The frontend verifies write results, blocks duplicate saves, validates prices/ratings/image URLs and restores controls after failures. Bulk publish retains drafts when writes fail.

Update data/catalogue.json before deploying if a newer emergency snapshot is needed. scripts/bake-catalogue.py updates the no-JavaScript HTML grid from that snapshot. Normal live catalogue changes do not require rebuilding HTML because the API refreshes them.

Tracking remains under maintenance pending provider configuration. The catalogue and admin improvements do not enable the tracking service.

Tests: node --test tests/*.test.cjs
