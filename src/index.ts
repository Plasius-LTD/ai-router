export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_ROUTER_PACKAGE = "@plasius/ai-router";
export const AI_ROUTER_FEATURE_FLAG_ID = "ai.router.enabled";
export const AI_ROUTER_ENV_PREFIX = "AI_ROUTER";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_ROUTER_PACKAGE,
  featureFlagId: AI_ROUTER_FEATURE_FLAG_ID,
  envPrefix: AI_ROUTER_ENV_PREFIX,
  summary: "Cost-aware AI task routing, budget, confidence, and SLO policy for Plasius agentic AI workloads.",
});
