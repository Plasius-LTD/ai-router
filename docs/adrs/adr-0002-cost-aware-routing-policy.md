# ADR-0002: Cost-aware routing policy engine in @plasius/ai-router

- Date: 2026-05-13
- Status: Accepted

## Context

`@plasius/ai-router` started with package metadata only and lacked runtime routing logic. We need deterministic provider selection that balances confidence, budget, and availability while preserving transparent observability for product and platform governance.

## Decision

Implement a policy-first route selection function, `selectAiProviderRoute`, that evaluates candidate providers in three phases:

- Primary selection with explicit policy constraints for enabled state, allow/deny lists, confidence, and cost/latency budgets.
- Escalation selection when enabled that relaxes confidence to `0` and temporarily relaxes cost constraints using an overage multiplier.
- Fallback selection when escalation is disabled or fails, prioritizing cheapest eligible candidates and ignoring confidence and budget constraints.

All failures return structured reasons and a deterministic candidate ranking to support auditable behavior in CI, dashboards, and ops tooling.

## Consequences

- Consumers can apply strict policy in normal operation and tune behavior under pressure with escalation/fallback.
- Routing output is fully deterministic across ties through secondary sorting by confidence and provider identifier.
- New feature contract is now public API and documented in package release notes.
- ADR and changelog are added as part of the same change set.
