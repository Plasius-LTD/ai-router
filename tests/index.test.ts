import { describe, expect, it } from "vitest";
import {
  type AiProviderConfigDefinition,
  resolveAiProviderConfig,
} from "@plasius/ai-config";
import {
  AI_ROUTER_ENV_PREFIX,
  AI_ROUTER_FEATURE_FLAG_ID,
  AI_ROUTER_PACKAGE,
  AI_ROUTER_DEFAULT_MINIMUM_CONFIDENCE,
  packageDescriptor,
  selectAiProviderRoute,
  type AiRoutingPolicy,
} from "../src/index.js";
import {
  type AiProviderCandidate,
  createFakeAiProviderAdapter,
  createAiProviderRegistry,
  type AiProviderRequest,
  type AiProviderConfigLookup,
  type AiProviderDescriptor,
  type AiProviderTier,
} from "@plasius/ai-providers";

describe("@plasius/ai-router", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_ROUTER_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_ROUTER_FEATURE_FLAG_ID);
    expect(packageDescriptor.featureFlagId).toBe("ai.cost-aware-routing.enabled");
    expect(packageDescriptor.envPrefix).toBe(AI_ROUTER_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });

  it("selects the best eligible candidate under primary policy", () => {
    const { candidates } = buildCandidateSet();
    const request = baseRequest("req-cheap-and-premium");

    const decision = selectAiProviderRoute(request.requestId, candidates, {
      enabled: true,
      minimumConfidence: 0.9,
      budget: {
        maxCostUsd: 10,
        maxLatencyMs: 1_000,
      },
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": 0.55,
        "premium-ai": 0.95,
      }),
    });

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.providerId).toBe("premium-ai");
    expect(decision.selected?.estimatedConfidence).toBe(0.95);
    expect(decision.selected?.estimatedCostUsd).toBe(2);
    expect(decision.candidates).toEqual([
      expect.objectContaining({ providerId: "cheap-ai" }),
      expect.objectContaining({ providerId: "premium-ai" }),
    ]);
  });

  it("uses default policy when no policy is supplied", () => {
    const { candidates } = buildCandidateSet();

    const decision = selectAiProviderRoute("req-default-policy", candidates);

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.providerId).toBe("premium-ai");
    expect(decision.selected?.estimatedConfidence).toBe(0.96);
  });

  it("orders equal-cost equal-confidence candidates by provider id", () => {
    const { candidates } = buildCandidateSet();
    const tiedCandidates: readonly AiProviderCandidate[] = candidates.map((candidate) => ({
      ...candidate,
      estimatedCostUsd: 1,
    }));

    const decision = selectAiProviderRoute("req-tied-candidates", tiedCandidates, {
      enabled: true,
      minimumConfidence: 0,
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": 0.8,
        "premium-ai": 0.8,
      }),
    });

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.providerId).toBe("cheap-ai");
    expect(decision.candidates.map((candidate) => candidate.providerId)).toEqual([
      "cheap-ai",
      "premium-ai",
    ]);
  });

  it("orders equal-cost candidates by confidence before provider id", () => {
    const { candidates } = buildCandidateSet();
    const tiedCandidates: readonly AiProviderCandidate[] = candidates.map((candidate) => ({
      ...candidate,
      estimatedCostUsd: 1,
    }));

    const decision = selectAiProviderRoute(
      "req-tied-confidence-candidates",
      tiedCandidates,
      {
        enabled: true,
        minimumConfidence: 0,
        confidenceEstimator: confidenceEstimator({
          "cheap-ai": 0.7,
          "premium-ai": 0.9,
        }),
      }
    );

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.providerId).toBe("premium-ai");
    expect(decision.candidates.map((candidate) => candidate.providerId)).toEqual([
      "premium-ai",
      "cheap-ai",
    ]);
  });

  it("normalizes non-finite confidence estimates to zero", () => {
    const { candidates } = buildCandidateSet();

    const decision = selectAiProviderRoute("req-non-finite-confidence", candidates, {
      enabled: true,
      minimumConfidence: 0,
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": Number.NaN,
        "premium-ai": Number.NaN,
      }),
    });

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.providerId).toBe("cheap-ai");
    expect(decision.selected?.estimatedConfidence).toBe(0);
  });

  it("uses the standard confidence baseline when provider tier is absent", () => {
    const { candidates } = buildCandidateSet();
    const candidate = candidates[0];
    if (!candidate) {
      throw new Error("Expected a test provider candidate.");
    }
    const missingTierCandidates: readonly AiProviderCandidate[] = [
      {
        ...candidate,
        config: {
          ...candidate.config,
          tier: undefined as never,
        },
      },
    ];

    const decision = selectAiProviderRoute(
      "req-missing-tier-baseline",
      missingTierCandidates,
      {
        enabled: true,
        minimumConfidence: 0.8,
      }
    );

    expect(decision.mode).toBe("selected");
    expect(decision.selected?.estimatedConfidence).toBe(0.82);
  });

  it("escalates by relaxing confidence and cost constraints", () => {
    const { candidates } = buildCandidateSet();
    const request = baseRequest("req-escalate");

    const decision = selectAiProviderRoute(request.requestId, candidates, {
      enabled: true,
      minimumConfidence: 0.99,
      budget: {
        maxCostUsd: 0.25,
      },
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": 0.55,
        "premium-ai": 0.95,
      }),
    });

    expect(decision.mode).toBe("escalated");
    expect(decision.selected?.providerId).toBe("cheap-ai");
    expect(decision.selected?.mode).toBe("escalated");
    expect(decision.selected?.estimatedCostUsd).toBe(0.1);
  });

  it("uses fallback when primary and escalation stages fail", () => {
    const { candidates } = buildCandidateSet();
    const request = baseRequest("req-fallback");

    const decision = selectAiProviderRoute(request.requestId, candidates, {
      enabled: true,
      minimumConfidence: 0.99,
      budget: {
        maxCostUsd: 0.05,
      },
      escalation: {
        enabled: false,
      },
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": 0.55,
        "premium-ai": 0.95,
      }),
    });

    expect(decision.mode).toBe("fallback");
    expect(decision.selected?.providerId).toBe("cheap-ai");
    expect(decision.selected?.estimatedCostUsd).toBe(0.1);
  });

  it("returns unavailable when all candidates are disabled and fallback is disabled", () => {
    const { candidates } = buildCandidateSet();
    const request = baseRequest("req-disabled-candidates");
    const disabledCandidates = candidates.map((candidate) => ({
      ...candidate,
      config: { ...candidate.config, enabled: false },
    }));

    const decision = selectAiProviderRoute(request.requestId, disabledCandidates, {
      enabled: true,
      minimumConfidence: 0,
      escalation: { enabled: false },
      fallback: { enabled: false },
    });

    expect(decision.mode).toBe("unavailable");
    expect(decision.selected).toBeUndefined();
    expect(decision.unavailableReasons).toContain("no-eligible-candidate");
    expect(decision.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasons: expect.arrayContaining([
          "provider-disabled",
          "provider-not-ready",
        ]),
      }),
    ]));
  });

  it("returns unavailable when every candidate exceeds latency budget and all policies are disabled", () => {
    const { candidates } = buildCandidateSet();
    const request = baseRequest("req-latency");

    const decision = selectAiProviderRoute(request.requestId, candidates, {
      enabled: true,
      minimumConfidence: 0,
      budget: {
        maxLatencyMs: 50,
      },
      escalation: {
        enabled: false,
      },
      fallback: {
        enabled: false,
      },
      confidenceEstimator: confidenceEstimator({
        "cheap-ai": 0.55,
        "premium-ai": 0.95,
      }),
    });

    expect(decision.mode).toBe("unavailable");
    expect(decision.selected).toBeUndefined();
  });

  it("returns unavailable when a cost budget requires missing estimates", () => {
    const { candidates } = buildCandidateSet();
    const missingCostCandidates: readonly AiProviderCandidate[] = candidates.map((candidate) => ({
      ...candidate,
      estimatedCostUsd: undefined,
    }));

    const decision = selectAiProviderRoute(
      "req-missing-cost",
      missingCostCandidates,
      {
        enabled: true,
        minimumConfidence: 0,
        budget: {
          maxCostUsd: 10,
        },
        escalation: {
          enabled: false,
        },
        fallback: {
          enabled: false,
        },
      }
    );

    expect(decision.mode).toBe("unavailable");
    expect(decision.selected).toBeUndefined();
    expect(decision.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: "cheap-ai",
        reasons: expect.arrayContaining(["cost-over-budget"]),
      }),
      expect.objectContaining({
        providerId: "premium-ai",
        reasons: expect.arrayContaining(["cost-over-budget"]),
      }),
    ]));
  });

  it("returns unavailable when candidates are not ready for request", () => {
    const { candidates } = buildNotReadyCandidateSet();
    const request = baseRequest("req-not-ready");
    const decision = selectAiProviderRoute(request.requestId, candidates, {
      enabled: true,
      minimumConfidence: 0,
      escalation: { enabled: false },
      fallback: { enabled: false },
    });

    expect(decision.mode).toBe("unavailable");
    expect(decision.selected).toBeUndefined();
  });

  it("returns unavailable when provider diagnostics include errors", () => {
    const { candidates } = buildCandidateSet();
    const diagnosticCandidates: readonly AiProviderCandidate[] = candidates.map((candidate) => ({
      ...candidate,
      readiness: {
        ...candidate.readiness,
        diagnostics: [
          {
            code: "provider-error",
            message: "provider reported an error",
            severity: "error",
          },
        ],
      },
    }));

    const decision = selectAiProviderRoute("req-diagnostic-error", diagnosticCandidates, {
      enabled: true,
      minimumConfidence: 0,
      escalation: { enabled: false },
      fallback: { enabled: false },
    });

    expect(decision.mode).toBe("unavailable");
    expect(decision.candidates[0]?.reasons).toContain("provider-not-ready");
  });

  it("returns disabled when policy gate is off", () => {
    const { candidates } = buildCandidateSet();

    const decision = selectAiProviderRoute("req-disabled", candidates, {
      enabled: false,
    });

    expect(decision.mode).toBe("disabled");
    expect(decision.candidates).toEqual([]);
    expect(decision.unavailableReasons).toContain("disabled-by-flag");
  });

  it("returns unavailable when every candidate is blocked", () => {
    const { candidates } = buildCandidateSet();

    const decision = selectAiProviderRoute(
      "req-denied",
      candidates,
      {
        enabled: true,
        minimumConfidence: AI_ROUTER_DEFAULT_MINIMUM_CONFIDENCE,
        allowProviderIds: ["none"],
        confidenceEstimator: confidenceEstimator({
          "cheap-ai": 0.55,
          "premium-ai": 0.95,
        }),
      } satisfies AiRoutingPolicy
    );

    expect(decision.mode).toBe("unavailable");
    expect(decision.selected).toBeUndefined();
    expect(decision.unavailableReasons).toContain("no-eligible-candidate");
  });

  it("uses allowlist and denylist policy gates when selecting", () => {
    const { candidates } = buildCandidateSet();

    const allowDecision = selectAiProviderRoute("req-allowlist", candidates, {
      enabled: true,
      allowProviderIds: ["premium-ai"],
      confidenceEstimator: confidenceEstimator({
        "premium-ai": 0.95,
      }),
    });

    expect(allowDecision.mode).toBe("selected");
    expect(allowDecision.selected?.providerId).toBe("premium-ai");

    const denyDecision = selectAiProviderRoute("req-denylist", candidates, {
      enabled: true,
      denyProviderIds: ["premium-ai"],
      minimumConfidence: 0,
    });

    expect(denyDecision.mode).toBe("selected");
    expect(denyDecision.selected?.providerId).toBe("cheap-ai");
  });

  it("returns unavailable when every provider is denied by policy", () => {
    const { candidates } = buildCandidateSet();

    const decision = selectAiProviderRoute("req-deny-all", candidates, {
      enabled: true,
      minimumConfidence: 0,
      denyProviderIds: ["cheap-ai", "premium-ai"],
      escalation: { enabled: false },
      fallback: { enabled: false },
    });

    expect(decision.mode).toBe("unavailable");
    expect(decision.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: "cheap-ai",
        reasons: expect.arrayContaining(["provider-denied-by-policy"]),
      }),
      expect.objectContaining({
        providerId: "premium-ai",
        reasons: expect.arrayContaining(["provider-denied-by-policy"]),
      }),
    ]));
  });

  it("clamps confidence policy bounds before route selection", () => {
    const { candidates } = buildCandidateSet();

    const highThreshold = selectAiProviderRoute("req-high-threshold", candidates, {
      enabled: true,
      minimumConfidence: 2,
      escalation: { enabled: false },
      fallback: { enabled: false },
    });
    const lowThreshold = selectAiProviderRoute("req-low-threshold", candidates, {
      enabled: true,
      minimumConfidence: -1,
      escalation: { enabled: false },
      fallback: { enabled: false },
    });

    expect(highThreshold.policy.minimumConfidence).toBe(1);
    expect(highThreshold.mode).toBe("unavailable");
    expect(lowThreshold.policy.minimumConfidence).toBe(0);
    expect(lowThreshold.mode).toBe("selected");
  });
});

function buildCandidateSet(): { readonly candidates: readonly AiProviderCandidate[] } {
  const cheapAdapter = createFakeAiProviderAdapter({
    descriptor: baseDescriptor({
      providerId: "cheap-ai",
      tier: "free",
      requestUsd: 0.1,
    }),
  });
  const premiumAdapter = createFakeAiProviderAdapter({
    descriptor: baseDescriptor({
      providerId: "premium-ai",
      tier: "premium",
      requestUsd: 2,
    }),
  });

  const registry = createAiProviderRegistry([cheapAdapter, premiumAdapter]);
  const configLookup = createConfigLookup([
    configDefinition("cheap-ai", "free"),
    configDefinition("premium-ai", "premium"),
  ]);

  const request = baseRequest("setup");
  const cheapCandidate = registry.findCapable(request, configLookup)[0];
  const premiumCandidate = registry.findCapable(request, configLookup)[1];

  if (!cheapCandidate || !premiumCandidate) {
    throw new Error("Expected to resolve both fake provider candidates.");
  }

  return { candidates: [cheapCandidate, premiumCandidate] };
}

function buildNotReadyCandidateSet(): { readonly candidates: readonly AiProviderCandidate[] } {
  const descriptor: AiProviderDescriptor = {
    providerId: "unready-ai",
    providerKind: "custom",
    displayName: "unready model",
    tier: "free",
    capabilities: ["tts"],
    models: [
      {
        modelId: "unready-ai-model",
        capabilities: ["tts"],
        tier: "free",
      },
    ],
    priority: 1,
    pricing: {
      requestUsd: 0.2,
      inputTokenUsdPerMillion: 0,
      outputTokenUsdPerMillion: 0,
    },
    slo: {
      timeoutMs: 250,
      p50LatencyMs: 120,
      p95LatencyMs: 240,
      availabilityTarget: 0.99,
    },
    cache: {
      cacheable: true,
      semanticCacheEligible: true,
      defaultTtlSeconds: 60,
      keyDimensions: ["providerId", "modelId", "kind"],
    },
    privacy: {
      allowedDataClasses: ["public", "internal", "personal", "sensitive"],
      allowProviderTraining: false,
      dataResidency: "local",
      retentionDays: 0,
    },
    tags: ["unready-ai"],
  };

  const adapter = createFakeAiProviderAdapter({ descriptor });
  const definition = configDefinition("unready-ai", "free");
  const config = resolveAiProviderConfig(definition, {
    [`${"UNREADY_AI_ENABLED"}`]: "true",
  });
  const request = baseRequest("req-not-ready");
  const readiness = adapter.canHandle(request, config);

  return {
    candidates: [
      Object.freeze({
        adapter,
        descriptor,
        config,
        readiness,
      }),
    ],
  };
}

function baseRequest(requestId: string): AiProviderRequest {
  return {
    requestId,
    kind: "chat",
    input: "hello from test",
    dataClass: "public",
    estimatedUsage: {
      requests: 1,
      inputTokens: 1_000,
      outputTokens: 500,
    },
  };
}

function configDefinition(providerId: string, tier: AiProviderTier): AiProviderConfigDefinition {
  return {
    providerId,
    providerKind: "custom",
    displayName: `${providerId} config`,
    tier,
    capabilities: ["chat", "reasoning", "embedding", "rag", "moderation", "tts", "stt", "mcp", "image", "video"],
    settings: {
      enabled: `${providerId.toUpperCase().replace(/-/gu, "_")}_ENABLED`,
    },
    defaults: {
      enabled: true,
    },
    dataPolicy: {
      allowedDataClasses: ["public", "internal", "personal", "sensitive"],
      allowProviderTraining: false,
    },
  };
}

function createConfigLookup(
  definitions: readonly AiProviderConfigDefinition[]
): AiProviderConfigLookup {
  return definitions.reduce<Record<string, ReturnType<typeof resolveAiProviderConfig>>>(
    (accumulator, definition) => {
      const config = resolveAiProviderConfig(definition, {
        [`${definition.providerId.toUpperCase().replace(/-/gu, "_")}_ENABLED`]:
          "true",
      });
      return {
        ...accumulator,
        [definition.providerId]: config,
      };
    },
    {}
  );
}

function baseDescriptor({
  providerId,
  tier,
  requestUsd,
}: {
  readonly providerId: string;
  readonly tier: AiProviderTier;
  readonly requestUsd: number;
}): AiProviderDescriptor {
  return {
    providerId,
    providerKind: "custom",
    displayName: `${providerId} model`,
    tier,
    capabilities: ["chat", "reasoning", "embedding", "moderation", "tts", "stt", "rag", "mcp", "image", "video"],
    models: [
      {
        modelId: `${providerId}-model`,
        capabilities: ["chat", "reasoning", "embedding", "moderation", "tts", "stt", "rag", "mcp", "image", "video"],
        tier,
      },
    ],
    priority: 0,
    pricing: {
      requestUsd,
      inputTokenUsdPerMillion: 0,
      outputTokenUsdPerMillion: 0,
    },
    slo: {
      timeoutMs: 400,
      p50LatencyMs: 200,
      p95LatencyMs: 420,
      availabilityTarget: 0.99,
    },
    cache: {
      cacheable: true,
      semanticCacheEligible: true,
      defaultTtlSeconds: 60,
      keyDimensions: ["providerId", "modelId", "kind"],
    },
    privacy: {
      allowedDataClasses: ["public", "internal", "personal", "sensitive"],
      allowProviderTraining: false,
      dataResidency: "local",
      retentionDays: 0,
    },
    tags: [providerId],
    metadata: {
      synthetic: true,
      syntheticTier: tier,
    },
  };
}

function confidenceEstimator(values: Record<string, number>) {
  return ({ candidate }: { candidate: AiProviderCandidate }) =>
    values[candidate.descriptor.providerId] ?? 0.5;
}
