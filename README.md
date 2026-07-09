<p align="center">
  <strong>OG</strong>
</p>

<p align="center">
  A small Cloudflare Worker for rendering cached Open Graph images from your own site.
</p>

<p align="center">
  <a href="https://github.com/iannuttall/og/actions"><img alt="checks" src="https://img.shields.io/github/actions/workflow/status/iannuttall/og/check.yml?branch=main&label=checks"></a>
  <a href="https://github.com/iannuttall/og/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-black"></a>
  <a href="SECURITY.md"><img alt="security" src="https://img.shields.io/badge/security-audit%20%2B%20gitleaks-3fb950"></a>
  <a href="https://workers.cloudflare.com/"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020"></a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/iannuttall/og"><img alt="Deploy to Cloudflare" src="https://deploy.workers.cloudflare.com/button"></a>
</p>

## What it does

This Worker takes a URL, opens that page with Cloudflare Browser Rendering, finds a `<template data-og-template>` element, screenshots it, and caches the image.

```txt
https://og.example.com/?url=https://example.com/post
```

It is intentionally not a SaaS app. There is no dashboard, auth system, billing, or database.

## Why it exists

Most OG image generators are either another service to pay for or a chunk of server code inside the main app. This keeps the job separate.

Your site owns the template. The Worker owns rendering, caching, and guardrails.

## Safety model

Browser Rendering can cost money if public visitors can force fresh renders. This template is built around that problem.

- Only allowlisted hosts can be rendered.
- `ALLOWED_HOSTS="*"` is rejected outside development.
- Public `?v=` cache busting is ignored.
- Image formats are allowlisted. PNG is the default.
- Cache hits are served from Workers Cache first, then R2.
- Browser renders pass through a Durable Object gate.
- The gate enforces concurrency, per-URL cooldowns, render budgets, and new URL limits.
- `/preview` and `/purge` require `PURGE_TOKEN`.

The defaults are conservative. Raise them after you know your traffic.

## Template contract

Add a template to any page you want rendered.

```html
<template data-og-template data-og-width="1200" data-og-height="630">
  <div style="width:1200px;height:630px;background:white;color:#111;">
    <h1>My page title</h1>
  </div>
</template>
```

If your template depends on client-side work, set the ready flag when it is complete.

```html
<script>
  window.__OG_READY__ = true;
</script>
```

If you do not set the flag, the Worker waits a few animation frames before it screenshots.

## Setup

Install dependencies.

```sh
pnpm install
```

Create a local env file.

```sh
cp .dev.vars.example .dev.vars
```

Create an R2 bucket.

```sh
pnpm wrangler r2 bucket create og-cache
```

Create a purge token.

```sh
pnpm wrangler secret put PURGE_TOKEN
```

Deploy.

```sh
pnpm deploy
```

Set your custom domain in Cloudflare, for example `og.example.com`.

## Config

Important config lives in `wrangler.jsonc`.

```jsonc
{
  "vars": {
    "ALLOWED_HOSTS": "example.com,www.example.com",
    "ALLOW_SUBDOMAINS": "false",
    "ALLOWED_FORMATS": "png",
    "BROWSER_POOL_MAX": "2",
    "MAX_RENDERS_PER_WINDOW": "1000",
    "MAX_NEW_URLS_PER_WINDOW": "500",
    "PER_URL_COOLDOWN_SECONDS": "3600"
  }
}
```

Use `.dev.vars` for local-only overrides. Do not commit real tokens.

## Local commands

```sh
pnpm dev
pnpm dev:remote
pnpm check
pnpm security:check
pnpm og doctor
pnpm og url https://example.com/post
pnpm og render https://example.com/post --out og.png
PURGE_TOKEN=... pnpm og preview https://example.com/post --out preview.png
PURGE_TOKEN=... pnpm og purge https://example.com/post
```

`pnpm dev` runs local Wrangler. Browser Rendering usually needs `pnpm dev:remote` or a `DEV_SCREENSHOT_URL` helper.

## API

Render an image.

```txt
GET /?url=https://example.com/post
GET /v1/og?url=https://example.com/post
```

Preview without using the cache.

```txt
GET /preview?url=https://example.com/post
Authorization: Bearer <PURGE_TOKEN>
```

Purge one or more URLs.

```sh
curl -X POST https://og.example.com/purge \
  -H "Authorization: Bearer $PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/post"}'
```

```sh
curl -X POST https://og.example.com/purge \
  -H "Authorization: Bearer $PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com/a","https://example.com/b"]}'
```

Purging bumps an owner-only cache version for that source URL. Public visitors cannot force that.

## How caching works

The cache key is based on:

- target URL
- image format
- image quality for non-PNG formats
- owner-controlled purge version

The Worker checks Workers Cache first. If that misses, it checks R2. Browser Rendering only runs when both caches miss and the render gate allows it.

## Security notes

- Do not use wildcard hosts in production.
- Keep `PURGE_TOKEN` secret.
- Keep format support narrow unless you need variants.
- Keep preflight enabled in production.
- Review `MAX_RENDERS_PER_WINDOW` before opening a new public host.
- Use Cloudflare WAF or rate limiting if a host attracts abuse.
- Run `pnpm security:check` before making the repo public or changing render
  controls.

See `SECURITY.md` for private vulnerability reporting.

## License

MIT.
