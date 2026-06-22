# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.4] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.3] - 2026-05-20

- **Added**
  - Added `selectAiProviderRoute` with multi-phase policy selection for primary, escalation, and fallback routing.
  - Added routing policy contracts for confidence, budget, allow/deny lists, and decision telemetry.

- **Changed**
  - Updated package feature flag contract to `ai.cost-aware-routing.enabled`.
  - Added dependency on `@plasius/ai-providers` and routing policy tests.

- **Fixed**
  - Release automation now prepares version/changelog updates on a release PR before publishing from protected `main`.
  - Budgeted routing now treats missing provider cost estimates as over budget instead of selectable.

- **Security**
  - (placeholder)

## [0.1.2] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.1] - 2026-05-13

- Added initial public package scaffold with governance, legal, docs, build, test, and pack-check baselines.


[0.1.1]: https://github.com/Plasius-LTD/ai-router/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/ai-router/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/ai-router/releases/tag/v0.1.3
[0.1.4]: https://github.com/Plasius-LTD/ai-router/releases/tag/v0.1.4
