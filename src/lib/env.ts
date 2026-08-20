import { z } from "zod";

const envSchema = z.object({
  GLM_API_KEY: z.string().min(1, "GLM_API_KEY is required"),
});

export function validateServerEnv(source: NodeJS.ProcessEnv = process.env) {
  return envSchema.safeParse(source);
}
