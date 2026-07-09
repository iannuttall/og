# Security

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting flow instead:

```txt
https://github.com/iannuttall/og/security/advisories/new
```

That keeps the report private inside GitHub and does not expose an email
address.

Please include:

- The affected route, command, or config option.
- Clear reproduction steps.
- The practical impact.
- Any logs, screenshots, request examples, or target URLs that make the issue
  easier to verify.

## Secret handling

- Production secrets must never be committed.
- Use ignored local env files for development:
  - `.env`
  - `.env.*`
  - `.dev.vars`
  - `.dev.vars.*`
- Checked-in example env files must contain only empty or placeholder values.
- Production secrets belong in GitHub Actions secrets, Cloudflare Worker
  secrets, or another managed secret store.

## Local checks

Run these before making the repo public, pushing sensitive changes, or changing
render/budget logic:

```sh
pnpm security:check
pnpm check
pnpm og doctor
pnpm exec wrangler deploy --dry-run
```

`pnpm security:check` runs `pnpm audit` and the local secret scan helper at
`scripts/security-secrets.mjs`. The helper runs `gitleaks`; on macOS it installs
`gitleaks` with Homebrew first if it is missing.
