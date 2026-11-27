# Search indexing: Google, Yandex, IndexNow

State 2026-11-26: firtech.pro had no pages in Google's index. Technicals are fine (robots, sitemap with 216 URLs,
canonical, hreflang); the site only needs to be announced.

## What the owner does

### Google Search Console
1. https://search.google.com/search-console, add the property (URL prefix) `https://firtech.pro`.
2. Choose the "HTML tag" method. Copy only the `content` value of `<meta name="google-site-verification" content="...">`.
3. Give it to the main window: it is set as the GitHub repository variable `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`; the next deploy renders the tag. Press Verify.
4. Sitemaps, add `https://firtech.pro/sitemap.xml`. Then URL inspection of `https://firtech.pro/ru`, "Request indexing".

### Yandex Webmaster
1. https://webmaster.yandex.com, add `https://firtech.pro`, verification by meta tag.
2. Copy the `content` of `<meta name="yandex-verification" content="...">` into the repository variable `NEXT_PUBLIC_YANDEX_VERIFICATION`, deploy, press Check.
3. Indexing, Sitemap files, add `https://firtech.pro/sitemap.xml`. Yandex also receives IndexNow pings.

### IndexNow (Bing, Yandex, Seznam, Naver)
No account is needed: the key file proves ownership.

## Where the key lives
- `INDEXNOW_KEY`, 32 hex characters (`openssl rand -hex 16`).
- GitHub secret `INDEXNOW_KEY` in the `production` environment (the deploy step reads it), and the same value in
  `/var/www/firtech/shared/.env.production` on the VPS (the site serves it). Restart the app after adding it to the env file.
- The site answers `GET /<key>.txt` with the key as text/plain (proxy rewrite to `/api/indexnow-key`); any other
  `/<32 hex>.txt` is 404, and everything is 404 while the variable is unset. Check: `curl https://firtech.pro/<key>.txt`.
- The deploy step "IndexNow" runs after the health check only when the secret is set and never fails the deploy.

## Run by hand
```
INDEXNOW_KEY=<key> node scripts/ops/indexnow.mjs                     # every URL of the sitemap
INDEXNOW_KEY=<key> node scripts/ops/indexnow.mjs --changed-since=2026-11-27T00:00:00Z
INDEXNOW_KEY=<key> node scripts/ops/indexnow.mjs --dry-run           # counts only
```
It reads `https://firtech.pro/sitemap.xml`, posts batches of at most 10 000 URLs to `https://api.indexnow.org/indexnow`
and exits 0 on HTTP 200/202. Google does not use IndexNow: for Google only Search Console (sitemap and URL inspection) counts.
