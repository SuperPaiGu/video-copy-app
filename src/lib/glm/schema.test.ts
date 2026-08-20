import { describe, expect, it } from "vitest";

import {
  copyGenerationResultSchema,
  parseCopyGenerationResult,
  variantSchema,
} from "@/lib/glm/schema";

describe("GLM result schema", () => {
  it("accepts exactly three valid variants", () => {
    const parsed = parseCopyGenerationResult({
      variants: [
        { title: "标题1", copy: "文案1", hashtags: ["#a", "#b"] },
        { title: "标题2", copy: "文案2", hashtags: ["#c"] },
        { title: "标题3", copy: "文案3", hashtags: ["#d", "#e"] },
      ],
    });

    expect(parsed.variants).toHaveLength(3);
    expect(parsed.variants[0].title).toBe("标题1");
  });

  it("rejects when variants length is not 3", () => {
    const result = copyGenerationResultSchema.safeParse({
      variants: [{ title: "only", copy: "one", hashtags: ["#tag"] }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed hashtag type", () => {
    const result = variantSchema.safeParse({
      title: "ok",
      copy: "ok",
      hashtags: "#not-array",
    });

    expect(result.success).toBe(false);
  });
});
