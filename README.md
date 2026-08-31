# @plasius/ai-router

[![npm version](https://img.shields.io/npm/v/@plasius/ai-router.svg)](https://www.npmjs.com/package/@plasius/ai-router)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/ai-router/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/ai-router/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/ai-router)](https://codecov.io/gh/Plasius-LTD/ai-router)
[![License](https://img.shields.io/github/license/Plasius-LTD/ai-router)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Cost-aware AI task routing, budget, confidence, and SLO policy for Plasius agentic AI workloads.

## Scope

This package is part of the layered `@plasius/ai-*` package family. It provides deterministic route selection with confidence, budget, escalation, and fallback policy controls.

## Install

```bash
npm install @plasius/ai-router
```

## Usage

```ts
import { packageDescriptor } from "@plasius/ai-router";

console.log(packageDescriptor.packageName);
```

```ts
import {
  selectAiProviderRoute,
  type AiRoutingPolicy,
} from "@plasius/ai-router";
import type { AiProviderCandidate } from "@plasius/ai-providers";

declare const candidates: readonly AiProviderCandidate[];
declare const requestId: string;

declare const policy: AiRoutingPolicy;

const decision = selectAiProviderRoute(requestId, candidates, policy);
console.log(decision.mode, decision.selected?.providerId);
```

## Development

```bash
npm install
npm run build
npm run typecheck
npm run test
npm run test:coverage
npm run lint
npm run pack:check
```

## Release Workflow

Protected `main` releases use a two-step flow:

1. Run `.github/workflows/cd.yml` with `bump=patch|minor|major` to open or refresh a `release/vX.Y.Z` prep PR.
2. Merge that PR to `main`.
3. Rerun `.github/workflows/cd.yml` on `main` with `bump=none` to tag, draft the GitHub release, and publish to npm.

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

Production package publication runs only from `.github/workflows/cd.yml` on
protected `main`. The job verifies that the prepared commit is still the
current main commit and has an exact successful `ci.yml` push result before it
mutates release state. Public package CI runs on GitHub-hosted capacity so it
cannot execute on company-managed runners. npm publication runs on
GitHub-hosted Node.js 24 with
npm 11.5.1 or newer, uses the protected `production` environment and
short-lived npm OIDC with provenance, and has no long-lived npm write-token
fallback. Rollback disables CD; it never rewrites published package history.
<!-- END PLASIUS RELEASE INTEGRITY -->
