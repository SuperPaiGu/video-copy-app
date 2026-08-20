import { describe, expect, it } from "vitest";

import { validateServerEnv } from "@/lib/env";

describe("validateServerEnv", () => {
  it("accepts env when GLM_API_KEY is present", () => {
    const result = validateServerEnv({ GLM_API_KEY: "test-key" });

    expect(result.success).toBe(true);
  });

  it("fails fast when GLM_API_KEY is missing", () => {
    const result = validateServerEnv({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/required|expected string/i);
    }
  });
});
