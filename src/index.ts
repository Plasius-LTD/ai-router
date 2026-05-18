import type {
  AiProviderCandidate,
  AiProviderTier,
  AiProviderDescriptor,
  AiProviderDiagnostic,
} from "@plasius/ai-providers";

export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_ROUTER_PACKAGE = "@plasius/ai-router";
export const AI_ROUTER_FEATURE_FLAG_ID = "ai.cost-aware-routing.enabled";
export const AI_ROUTER_ENV_PREFIX = "AI_ROUTER";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_ROUTER_PACKAGE,
  featureFlagId: AI_ROUTER_FEATURE_FLAG_ID,
  envPrefix: AI_ROUTER_ENV_PREFIX,
  summary:
    "Cost-aware AI task routing, budget, confidence, and SLO policy for Plasius agentic AI workloads.",
});

export const AI_ROUTER_DEFAULT_MINIMUM_CONFIDENCE = 0.75;
export const AI_ROUTER_DEFAULT_BUDGET_OVERAGE_MULTIPLIER = 1.5;

export type AiRoutingDecisionMode =
  | "disabled"
  | "selected"
  | "escalated"
  | "fallback"
  | "unavailable";

export type AiRoutingDecisionReason =
  | "disabled-by-flag"
  | "provider-list-empty"
  | "provider-denied-by-policy"
  | "provider-allowlist-miss"
  | "provider-disabled"
  | "provider-not-ready"
  | "cost-over-budget"
  | "latency-over-budget"
  | "confidence-under-threshold"
  | "no-eligible-candidate"
  | "selected";

export interface AiProviderConfidenceEstimatorContext {
  readonly candidate: AiProviderCandidate;
  readonly mode: Exclude<AiRoutingDecisionMode, "unavailable" | "disabled">;
}

export type AiProviderConfidenceEstimator = (
  context: AiProviderConfidenceEstimatorContext
) => number;

export interface AiRoutingBudgetPolicy {
  readonly maxCostUsd?: number;
  readonly maxLatencyMs?: number;
}

export interface AiRoutingEscalationPolicy {
  readonly enabled: boolean;
  readonly overageMultiplier?: number;
}

export interface AiRoutingFallbackPolicy {
  readonly enabled: boolean;
}

export interface AiRoutingPolicy {
  readonly enabled: boolean;
  readonly minimumConfidence?: number;
  readonly allowProviderIds?: readonly string[];
  readonly denyProviderIds?: readonly string[];
  readonly budget?: AiRoutingBudgetPolicy;
  readonly confidenceEstimator?: AiProviderConfidenceEstimator;
  readonly escalation?: AiRoutingEscalationPolicy;
  readonly fallback?: AiRoutingFallbackPolicy;
}

export interface AiRoutingCandidateAssessment {
  readonly providerId: string;
  readonly providerModelId?: string;
  readonly estimatedCostUsd?: number;
  readonly estimatedLatencyMs?: number;
  readonly estimatedConfidence: number;
  readonly descriptor: AiProviderDescriptor;
  readonly providerTier: AiProviderTier;
  readonly reasons: readonly AiRoutingDecisionReason[];
  readonly mode: Exclude<AiRoutingDecisionMode, "unavailable" | "disabled">;
}

export interface AiRoutingDecision {
  readonly requestId: string;
  readonly mode: AiRoutingDecisionMode;
  readonly policy: Readonly<AiRoutingPolicy>;
  readonly selected?: AiRoutingCandidateAssessment;
  readonly candidates: readonly AiRoutingCandidateAssessment[];
  readonly unavailableReasons: readonly AiRoutingDecisionReason[];
}

type NormalizedAiRoutingPolicy = Readonly<
  Omit<AiRoutingPolicy, "minimumConfidence" | "escalation" | "fallback"> & {
    readonly minimumConfidence: number;
    readonly escalation: Readonly<Required<AiRoutingEscalationPolicy>>;
    readonly fallback: Readonly<Required<AiRoutingFallbackPolicy>>;
  }
>;

const DEFAULT_ROUTING_ESCALATION_POLICY: Readonly<
  Required<AiRoutingEscalationPolicy>
> = Object.freeze({
  enabled: true,
  overageMultiplier: AI_ROUTER_DEFAULT_BUDGET_OVERAGE_MULTIPLIER,
});

const DEFAULT_ROUTING_FALLBACK_POLICY: Readonly<
  Required<AiRoutingFallbackPolicy>
> = Object.freeze({
  enabled: true,
});

const DEFAULT_ROUTING_POLICY: NormalizedAiRoutingPolicy = Object.freeze({
  enabled: true,
  minimumConfidence: AI_ROUTER_DEFAULT_MINIMUM_CONFIDENCE,
  escalation: DEFAULT_ROUTING_ESCALATION_POLICY,
  fallback: DEFAULT_ROUTING_FALLBACK_POLICY,
});

const DEFAULT_BASELINE_CONFIDENCE: Record<AiProviderTier, number> = {
  free: 0.45,
  development: 0.62,
  standard: 0.82,
  premium: 0.96,
};

const DECISION_COMPARATOR = (left: AiRoutingCandidateAssessment, right: AiRoutingCandidateAssessment): number => {
  const leftCost = left.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
  const rightCost = right.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
  const costComparison = leftCost - rightCost;
  if (costComparison !== 0) {
    return costComparison;
  }

  const confidenceComparison = right.estimatedConfidence - left.estimatedConfidence;
  if (confidenceComparison !== 0) {
    return confidenceComparison;
  }

  return left.providerId.localeCompare(right.providerId);
};

function normalizeBoolean(value: boolean): boolean {
  return value === true;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function asFrozenReasons(
  reasons: readonly AiRoutingDecisionReason[]
): readonly AiRoutingDecisionReason[] {
  return Object.freeze([...reasons]);
}

function normalizePolicy(policy: AiRoutingPolicy = DEFAULT_ROUTING_POLICY): NormalizedAiRoutingPolicy {
  const minimumConfidence = clampConfidence(
    policy.minimumConfidence ?? DEFAULT_ROUTING_POLICY.minimumConfidence
  );
  const escalation = policy.escalation ?? DEFAULT_ROUTING_POLICY.escalation;
  const fallback = policy.fallback ?? DEFAULT_ROUTING_POLICY.fallback;
  const normalizedEscalation = Object.freeze({
    enabled: normalizeBoolean(escalation.enabled),
    overageMultiplier:
      escalation.overageMultiplier ??
      DEFAULT_ROUTING_POLICY.escalation.overageMultiplier,
  });
  const normalizedFallback = Object.freeze({
    enabled: normalizeBoolean(fallback.enabled),
  });

  return Object.freeze({
    enabled: normalizeBoolean(policy.enabled),
    minimumConfidence,
    allowProviderIds: policy.allowProviderIds
      ? Object.freeze([...policy.allowProviderIds])
      : undefined,
    denyProviderIds: policy.denyProviderIds
      ? Object.freeze([...policy.denyProviderIds])
      : undefined,
    budget: policy.budget ? Object.freeze({ ...policy.budget }) : undefined,
    confidenceEstimator: policy.confidenceEstimator,
    escalation: normalizedEscalation,
    fallback: normalizedFallback,
  });
}

function estimateConfidence(
  candidate: AiProviderCandidate,
  policy: NormalizedAiRoutingPolicy,
  mode: Exclude<AiRoutingDecisionMode, "unavailable" | "disabled">
): number {
  const baseline = DEFAULT_BASELINE_CONFIDENCE[candidate.config.tier ?? "standard"];
  if (policy.confidenceEstimator) {
    return clampConfidence(
      policy.confidenceEstimator({
        candidate,
        mode,
      })
    );
  }

  return baseline;
}

function isReady(candidate: AiProviderCandidate): boolean {
  return (
    candidate.readiness.supported &&
    candidate.readiness.enabled &&
    candidate.config.enabled &&
    !candidate.readiness.diagnostics.some(
      (diagnostic: AiProviderDiagnostic) => diagnostic.severity === "error"
    )
  );
}

function isAllowedByPolicy(
  candidate: AiProviderCandidate,
  policy: NormalizedAiRoutingPolicy
): {
  allowed: boolean;
  reason?: AiRoutingDecisionReason;
} {
  if (policy.denyProviderIds?.includes(candidate.descriptor.providerId)) {
    return { allowed: false, reason: "provider-denied-by-policy" };
  }

  if (
    policy.allowProviderIds &&
    !policy.allowProviderIds.includes(candidate.descriptor.providerId)
  ) {
    return { allowed: false, reason: "provider-allowlist-miss" };
  }

  return { allowed: true };
}

function estimateLatency(candidate: AiProviderCandidate): number | undefined {
  const slo = candidate.descriptor.slo;
  return slo?.timeoutMs;
}

function estimateCost(candidate: AiProviderCandidate): number | undefined {
  return candidate.estimatedCostUsd;
}

function buildAssessments(
  requestId: string,
  candidates: readonly AiProviderCandidate[],
  policy: NormalizedAiRoutingPolicy,
  mode: Exclude<AiRoutingDecisionMode, "unavailable" | "disabled">
): readonly AiRoutingCandidateAssessment[] {
  const evaluations = candidates.map((candidate) => {
    const reasons: AiRoutingDecisionReason[] = [];
    const allowed = isAllowedByPolicy(candidate, policy);
    if (!allowed.allowed && allowed.reason) {
      reasons.push(allowed.reason);
    }

    if (!candidate.config.enabled) {
      reasons.push("provider-disabled");
    }

    if (!isReady(candidate)) {
      reasons.push("provider-not-ready");
    }

    const estimatedConfidence = estimateConfidence(candidate, policy, mode);
    const estimatedLatencyMs = estimateLatency(candidate);
    const estimatedCostUsd = estimateCost(candidate);

    const maxCost = policy.budget?.maxCostUsd;
    if (
      maxCost !== undefined &&
      (estimatedCostUsd === undefined || estimatedCostUsd > maxCost)
    ) {
      reasons.push("cost-over-budget");
    }

    const maxLatency = policy.budget?.maxLatencyMs;
    if (
      maxLatency !== undefined &&
      estimatedLatencyMs !== undefined &&
      estimatedLatencyMs > maxLatency
    ) {
      reasons.push("latency-over-budget");
    }

    if (policy.minimumConfidence > estimatedConfidence) {
      reasons.push("confidence-under-threshold");
    }

    if (reasons.length === 0) {
      reasons.push("selected");
    }

    return Object.freeze({
      providerId: candidate.descriptor.providerId,
      providerModelId: candidate.readiness.selectedModelId,
      estimatedCostUsd,
      estimatedLatencyMs,
      estimatedConfidence,
      descriptor: candidate.descriptor,
      providerTier: candidate.config.tier,
      reasons: asFrozenReasons(reasons),
      mode,
    });
  });

  return Object.freeze([...evaluations].sort(DECISION_COMPARATOR));
}

function hasBlockingReasons(
  assessment: AiRoutingCandidateAssessment,
  includeConfidence: boolean
): boolean {
  const blocking = new Set<AiRoutingDecisionReason>(assessment.reasons);
  const hardBlockingReasons: readonly AiRoutingDecisionReason[] = [
    "provider-allowlist-miss",
    "provider-denied-by-policy",
    "provider-disabled",
    "provider-not-ready",
    "cost-over-budget",
    "latency-over-budget",
  ];

  return (
    hardBlockingReasons.some((reason) => blocking.has(reason)) ||
    (includeConfidence && blocking.has("confidence-under-threshold"))
  );
}

function pickCandidate(
  candidates: readonly AiRoutingCandidateAssessment[],
  includeConfidence: boolean
): AiRoutingCandidateAssessment | undefined {
  return candidates.find(
    (candidate) => !hasBlockingReasons(candidate, includeConfidence)
  );
}

function createUnavailableDecision(
  requestId: string,
  policy: NormalizedAiRoutingPolicy,
  candidates: readonly AiProviderCandidate[]
): AiRoutingDecision {
  const assessments = buildAssessments(
    requestId,
    candidates,
    policy,
    "fallback"
  );
  const reasons = ["no-eligible-candidate"] as AiRoutingDecisionReason[];

  return Object.freeze({
    requestId,
    mode: "unavailable",
    policy,
    candidates: assessments,
    unavailableReasons: asFrozenReasons(reasons),
  });
}

export function selectAiProviderRoute(
  requestId: string,
  candidates: readonly AiProviderCandidate[],
  policy: AiRoutingPolicy = DEFAULT_ROUTING_POLICY
): AiRoutingDecision {
  const normalizedPolicy = normalizePolicy(policy);
  if (!normalizedPolicy.enabled) {
    return Object.freeze({
      requestId,
      mode: "disabled",
      policy: normalizedPolicy,
      candidates: [],
      unavailableReasons: asFrozenReasons(["disabled-by-flag"]),
    });
  }

  const primaryAssessments = buildAssessments(
    requestId,
    candidates,
    normalizedPolicy,
    "selected"
  );

  const primary = pickCandidate(primaryAssessments, true);
  if (primary) {
    return Object.freeze({
      requestId,
      mode: "selected",
      policy: normalizedPolicy,
      selected: primary,
      candidates: primaryAssessments,
      unavailableReasons: [],
    });
  }

  const escalation = normalizedPolicy.escalation;
  const escalationPolicy: NormalizedAiRoutingPolicy = escalation.enabled
    ? Object.freeze({
        ...normalizedPolicy,
        minimumConfidence: 0,
        budget: normalizedPolicy.budget?.maxCostUsd
          ? Object.freeze({
              ...normalizedPolicy.budget,
              maxCostUsd:
                normalizedPolicy.budget.maxCostUsd *
                escalation.overageMultiplier,
            })
          : normalizedPolicy.budget,
      })
    : normalizedPolicy;

  if (escalation.enabled) {
    const escalatedAssessments = buildAssessments(
      requestId,
      candidates,
      escalationPolicy,
      "escalated"
    );
    const escalated = pickCandidate(escalatedAssessments, false);

    if (escalated) {
      return Object.freeze({
        requestId,
        mode: "escalated",
        policy: normalizedPolicy,
        selected: escalated,
        candidates: escalatedAssessments,
        unavailableReasons: [],
      });
    }
  }

  if (normalizedPolicy.fallback.enabled) {
    const fallbackAssessments = buildAssessments(
      requestId,
      candidates,
      {
        ...normalizedPolicy,
        minimumConfidence: 0,
        budget: undefined,
      },
      "fallback"
    );
    const fallback = pickCandidate(fallbackAssessments, false);

    if (fallback) {
      return Object.freeze({
        requestId,
        mode: "fallback",
        policy: normalizedPolicy,
        selected: fallback,
        candidates: fallbackAssessments,
        unavailableReasons: [],
      });
    }
  }

  return createUnavailableDecision(requestId, normalizedPolicy, candidates);
}
