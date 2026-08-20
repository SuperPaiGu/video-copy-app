import { GLMProvider } from "./provider";
import { parseCopyGenerationResult, type CopyGenerationResult } from "@/lib/glm/schema";

export const GLM_DEFAULT_MODEL = "glm-4.1v-thinking-flash";
export const GLM_DEFAULT_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

export const DOUYIN_FIXED_PROMPT = `You are a Douyin copywriting assistant.
Return STRICT JSON only with this shape:
{"variants":[{"title":"...","copy":"...","hashtags":["#tag1","#tag2"]},{"title":"...","copy":"...","hashtags":["#tag1"]},{"title":"...","copy":"...","hashtags":["#tag1"]}]}

Rules:
1) Return exactly 3 variants.
2) Each variant must include title, copy, hashtags.
3) hashtags must be an array of hashtag strings prefixed with #.
4) Do not include markdown, prose, or extra keys.`;

export interface FrameImageInput {
  mimeType: string;
  data: Buffer;
}

interface GLMMessageTextPart {
  type: "text";
  text: string;
}

interface GLMMessageImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

interface GLMResponseShape {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

export class GLMProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GLMProviderError";
  }
}

export interface GLMProviderOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class GLMProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GLMProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new GLMProviderError("Missing GLM_API_KEY for GLM provider");
    }

    this.apiKey = apiKey;
    this.endpoint = options.endpoint ?? GLM_DEFAULT_ENDPOINT;
    this.model = options.model ?? GLM_DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(
    frames: FrameImageInput[],
    transcript: string,
    prompt: string
  ): Promise<CopyGenerationResult> {
    if (frames.length === 0) {
      throw new GLMProviderError("At least one frame image is required");
    }

    const userText = [
      "Video transcript:",
      transcript.trim() || "(empty)",
      "Business instruction:",
      prompt.trim() || "(none)",
      "Generate Douyin-ready content in Chinese.",
    ].join("\n");

    const userContent: Array<GLMMessageTextPart | GLMMessageImagePart> = [
      {
        type: "text",
        text: userText,
      },
      ...frames.map((frame) => ({
        type: "image_url" as const,
        image_url: {
          url: toDataUrl(frame),
        },
      })),
    ];

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: DOUYIN_FIXED_PROMPT,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000), // 60秒超时
    });

    if (!response.ok) {
      throw new GLMProviderError(`GLM request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GLMResponseShape;
    const content = payload.choices?.[0]?.message?.content;
    const contentText = normalizeMessageContent(content);
    const jsonText = extractJson(contentText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new GLMProviderError("Invalid structured output: response is not valid JSON");
    }

    try {
      return parseCopyGenerationResult(parsed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "schema parse failed";
      throw new GLMProviderError(`Invalid structured output: schema validation failed (${reason})`);
    }
  }
}

function toDataUrl(frame: FrameImageInput): string {
  if (!frame.mimeType || !frame.mimeType.startsWith("image/")) {
    throw new GLMProviderError("Invalid frame image mime type");
  }

  return `data:${frame.mimeType};base64,${frame.data.toString("base64")}`;
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .filter((part): part is { type: string; text?: string } => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  throw new GLMProviderError("Invalid structured output: missing assistant content");
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  throw new GLMProviderError("Invalid structured output: JSON object not found");
}
