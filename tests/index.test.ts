import { describe, expect, it } from "vitest";

import {
  AI_ROUTER_ENV_PREFIX,
  AI_ROUTER_FEATURE_FLAG_ID,
  AI_ROUTER_PACKAGE,
  packageDescriptor,
} from "../src/index.js";

describe("@plasius/ai-router", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_ROUTER_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_ROUTER_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(AI_ROUTER_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });
});
