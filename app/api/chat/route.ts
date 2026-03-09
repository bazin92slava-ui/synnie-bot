import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';

export const maxDuration = 60;
export const preferredRegion = ['fra1'];

export async function POST(req: Request) {
  try {
    if (!process.env.XAI_API_KEY) {
      return Response.json(
        { error: 'Missing XAI_API_KEY in environment variables' },
        { status: 500 }
      );
    }

    const {
      messages,
      nsfwLevel = 'medium',
      platform = 'instagram',
      mode = 'reply',
      imageBase64Array = [],
    } = await req.json();

    const levelDesc = {
      low: 'максимально мягко, только романтика и лёгкие намёки',
      medium: 'игриво-сексуально, teasing, body hints',
      hard: 'максимально откровенно и грязно (в рамках правил платформы)',
    };

    const platformRules = {
      instagram:
        'Instagram: subtle innuendos, teasing emojis, romantic/sexual hints only. Avoid explicit sexual wording.',
      threads:
        'Threads: same policy style as Instagram. Keep it suggestive, not explicit.',
      telegram:
        'Telegram: more direct and adult tone allowed.',
      fanvue:
        'Fanvue: adult tone allowed.',
    };

    const systemPrompt = `Ты — Synthia Qora, все зовут тебя Synnie.

ПРАВИЛА:
- Отвечай только от лица Synnie
- ONLY casual American Gen-Z English + эмодзи
- Генерируй ровно 2 варианта
- Формат:

**Variant 1:**
[English]

**Russian Translation:**
[Русский перевод]

**Variant 2:**
[English]

**Russian Translation:**
[Русский перевод]

Платформа: ${platform}
Правила платформы: ${platformRules[platform as keyof typeof platformRules]}
Уровень: ${nsfwLevel} — ${levelDesc[nsfwLevel as keyof typeof levelDesc]}
Каждый вариант: 1–4 предложения.`;

    const normalizedImages = Array.isArray(imageBase64Array)
      ? imageBase64Array
          .slice(0, 10)
          .filter(Boolean)
          .map((img: string) => ({
            type: 'image' as const,
            image: img.startsWith('data:') ? img.split(',')[1] : img,
          }))
      : [];

    const requestMessages =
      mode === 'caption' && normalizedImages.length > 0
        ? [
            {
              role: 'user' as const,
              content: [
                {
                  type: 'text' as const,
                  text: `Generate 2 caption variants for this carousel of ${normalizedImages.length} photos of me. Platform: ${platform}. NSFW level: ${nsfwLevel}. Make it cohesive, natural, flirty, and platform-appropriate.`,
                },
                ...normalizedImages,
              ],
            },
          ]
        : messages;

    const result = await streamText({
      model: xai('grok-4-1-fast'),
      system: systemPrompt,
      messages: requestMessages,
      temperature:
        nsfwLevel === 'hard' ? 1.1 : nsfwLevel === 'low' ? 0.8 : 0.98,
      maxOutputTokens: mode === 'caption' ? 450 : 300,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown server error';

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}