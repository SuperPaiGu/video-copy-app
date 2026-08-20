import { z } from "zod";

export const variantSchema = z.object({
  title: z.string().min(1),
  copy: z.string().min(1),
  hashtags: z.array(z.string().min(1)),
});

export const copyGenerationResultSchema = z.object({
  variants: z.array(variantSchema).length(3),
});

export type CopyVariant = z.infer<typeof variantSchema>;
export type CopyGenerationResult = z.infer<typeof copyGenerationResultSchema>;

export function parseCopyGenerationResult(input: unknown): CopyGenerationResult {
  return copyGenerationResultSchema.parse(input);
}
