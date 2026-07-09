# OG Worker task list

## Build

- [x] Keep the Worker no-UI and render from `<template data-og-template>`.
- [x] Move config to public-safe `wrangler.jsonc`.
- [x] Add Workers Cache, R2, Browser Rendering, and Durable Object bindings.
- [x] Remove public cache busting through arbitrary `?v=` values.
- [x] Add format allowlisting so visitors cannot force extra variants.
- [x] Add streaming preflight checks before Browser Rendering.
- [x] Add a render gate for concurrency, per-URL cooldowns, render budgets, and new URL limits.
- [x] Add local CLI helpers for render, preview, purge, and config checks.
- [x] Add tests for URL validation, config safety, cache keys, and option parsing.
- [x] Generate Worker types from Wrangler config.
- [x] Run local checks.

## ian.is

- [x] Add a reusable OG template component.
- [x] Add a local `?og` preview mode.
- [x] Point layout metadata at `https://og.ian.is/?url=<canonical>`.

## Existing sites

- [ ] Keep `keep.md` and `ilo.so` on `ogtag.xyz`.
- [x] Audit `namecensus`, `namecensus-uk`, and `howmanyofme` before moving them off old `og.ian.is`.
- [ ] Do not migrate huge pSEO sites until cache hit rates and first-render budgets are understood.

## Publishing

- [x] Replace README with public template docs.
- [x] Add `AGENTS.md` and a `CLAUDE.md` symlink.
- [x] Add MIT license.
- [ ] Add GitHub repo description.
- [ ] Make the repo public only after security checks pass.
- [x] Decide whether to orphan/reset git history before public launch.
- [ ] Orphan/reset git history immediately before publishing.
