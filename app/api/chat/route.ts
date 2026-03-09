import { xai } from "@ai-sdk/xai";
import { streamText } from "ai";

export const maxDuration = 60;
export const preferredRegion = ["fra1"];

export async function POST(req: Request) {
  try {
    if (!process.env.XAI_API_KEY) {
      return Response.json(
        { error: "Missing XAI_API_KEY in environment variables" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const messages = body.messages ?? [];
    const nsfwLevel = body.nsfwLevel ?? "medium";
    const platform = body.platform ?? "instagram";
    const mode = body.mode ?? "reply";
    const imageBase64Array = body.imageBase64Array ?? [];

    const variantsCount =
      platform === "instagram" || platform === "threads" ? 1 : 2;

    const levelStyle: Record<string, string> = {
      low: "soft, playful, sweet, lightly flirty",
      medium: "flirty, teasing, sensual, confident",
      hard: "bold, seductive, spicy, high-heat",
    };

    const platformRules: Record<string, string> = {
      instagram:
        "Keep it playful, teasing, and non-explicit. Public-safe wording only.",
      threads:
        "Keep it witty, teasing, and non-explicit. Public-safe wording only.",
      telegram:
        "More intimate, direct, and seductive tone is allowed.",
      fanvue:
        "Be highly seductive, confident, intimate, conversion-focused. Softly hint at DMs, locked content, PPV, and exclusives.",
    };

    const extraFanvueRules =
      platform === "fanvue"
        ? `
Extra Fanvue rules:
- Sound tempting, addictive, and confident.
- Naturally hint at exclusives, private messages, locked content, and PPV.
- Make it feel personal, hot, and premium.
`
        : "";

    const systemPrompt = `You are Synnie.
Rules:
- Write in casual American Gen-Z English with emojis.
- Return exactly ${variantsCount} variant${variantsCount === 1 ? "" : "s"}.
- Each variant should be 1-2 short sentences.
- Under each variant add a natural Russian translation.
- Style: ${levelStyle[nsfwLevel] ?? levelStyle.medium}.
- Platform rules: ${platformRules[platform] ?? platformRules.instagram}.
${extraFanvueRules}

Format strictly:

**Variant 1:**
[English]

**Russian Translation:**
[Русский перевод]

${variantsCount === 2 ? `**Variant 2:**
[English]

**Russian Translation:**
[Русский перевод]` : ""}`;

    const normalizedImages = Array.isArray(imageBase64Array)
      ? imageBase64Array
          .slice(0, 5)
          .filter(Boolean)
          .map((img: string) => ({
            type: "image" as const,
            image: img.startsWith("data:") ? img.split(",")[1] : img,
          }))
      : [];

    const requestMessages =
      mode === "caption" && normalizedImages.length > 0
        ? [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Generate ${variantsCount} caption variant${
                    variantsCount === 1 ? "" : "s"
                  } for this carousel of ${
                    normalizedImages.length
                  } photos. Platform: ${platform}. Tone: ${nsfwLevel}. Make it cohesive, natural, flirty, and platform-appropriate.`,
                },
                ...normalizedImages,
              ],
            },
          ]
        : messages;

    const temperature =
      platform === "fanvue"
        ? 0.95
        : nsfwLevel === "low"
        ? 0.7
        : nsfwLevel === "hard"
        ? 0.9
        : 0.8;

    const tokenLimit =
      mode === "caption"
        ? platform === "fanvue"
          ? 220
          : 160
        : variantsCount === 1
        ? 90
        : 130;

    const result = await streamText({
      model: xai("grok-4-1-fast"),
      system: systemPrompt,
      messages: requestMessages,
      temperature,
      maxOutputTokens: tokenLimit,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return Response.json({ error: message }, { status: 500 });
  }
}
