import type { AsrProvider } from "./types";
import { WhisperAsrProvider } from "./whisper-provider";

/**
 * Transcribe audio file to text
 * Handles no_audio case gracefully by returning null
 *
 * @param audioPath - Path to audio file, or null if no audio
 * @param provider - ASR provider instance (defaults to WhisperAsrProvider)
 * @returns Cleaned transcript text or null if no audio
 */
export async function transcribeAudio(
  audioPath: string | null,
  provider?: AsrProvider,
): Promise<string | null> {
  // Handle no_audio case: return null without crashing
  if (!audioPath) {
    return null;
  }

  const asrProvider = provider ?? new WhisperAsrProvider();
  return asrProvider.transcribe(audioPath);
}
