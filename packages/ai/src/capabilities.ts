/**
 * Capability boundaries: features the commerce agent is designed for but that
 * need something this deployment doesn't have. Each says honestly why it's
 * off, so no surface ever fakes it.
 */

export interface Capability {
  enabled: boolean;
  /** Customer-facing explanation when disabled. */
  reason: string;
}

/**
 * Visual search ("find something like this photo"). Needs a multimodal chat
 * model AND an image path (web upload / Telegram photo → model). Neither is
 * configured: the default model (Groq qwen) is text-only and chat has no
 * upload, so it stays off rather than pretending to see.
 *
 * To enable later: set AI_VISION_MODEL to a vision-capable model on the same
 * provider, add image parts to the chat request, then pass them to
 * searchMarket as extracted attributes (colour, category, style).
 */
export function visionCapability(env: Record<string, string | undefined> = process.env): Capability {
  if (env.AI_VISION_MODEL) {
    return { enabled: false, reason: "Photo search is being set up and isn't available yet — describe the item (type, colour, style) and I'll find it." };
  }
  return { enabled: false, reason: "I can't search by photo yet — tell me what it is (type, colour, style) and I'll find similar items." };
}
