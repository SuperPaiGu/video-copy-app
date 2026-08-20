import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DOUYIN_FIXED_PROMPT,
  GLMProvider,
  GLMProviderError,
  type FrameImageInput,
} from "@/lib/glm/provider";

const makeFrame = (text: string): FrameImageInput => ({
  mimeType: "image/jpeg",
  data: Buffer.from(text),
});

describe("GLMProvider contract", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends frames + transcript + fixed prompt and returns exactly 3 variants", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  { title: "标题一", copy: "文案一", hashtags: ["#旅行", "#Vlog"] },
                  { title: "标题二", copy: "文案二", hashtags: ["#攻略", "#出行"] },
                  { title: "标题三", copy: "文案三", hashtags: ["#拍摄", "#打卡"] },
                ],
              }),
            },
          },
        ],
      }),
    });

    const provider = new GLMProvider({ apiKey: "test-key" });

    const result = await provider.generate(
      [makeFrame("frame-1"), makeFrame("frame-2")],
      "今天去了海边，落日很好看。",
      "突出治愈感和生活感"
    );

    expect(result.variants).toHaveLength(3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("chat/completions");
    expect(options.method).toBe("POST");

    const body = JSON.parse(String(options.body));
    expect(body.model).toBe("glm-4.1v-thinking-flash");
    expect(body.messages[0].content).toContain(DOUYIN_FIXED_PROMPT.trim());
    expect(body.messages[1].content[0].text).toContain("今天去了海边");
    expect(body.messages[1].content[0].text).toContain("突出治愈感和生活感");
    expect(body.messages[1].content.filter((item: { type: string }) => item.type === "image_url")).toHaveLength(2);
  });

  it("rejects malformed model output with explicit error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  { copy: "缺少标题", hashtags: ["#bad"] },
                  { title: "ok", copy: "ok", hashtags: ["#ok"] },
                  { title: "ok2", copy: "ok2", hashtags: ["#ok2"] },
                ],
              }),
            },
          },
        ],
      }),
    });

    const provider = new GLMProvider({ apiKey: "test-key" });

    let thrown: unknown;
    try {
      await provider.generate([makeFrame("frame")], "transcript", "prompt");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GLMProviderError);
    expect((thrown as Error).message).toMatch(/invalid structured output|schema/i);
  });
});
