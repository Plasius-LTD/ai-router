# @plasius/ai-router

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

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
