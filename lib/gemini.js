import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

const PROMPT = `Extract player statistics from this SMITE 2 end-of-game Details screen.

The screen shows two teams side by side:
- Blue-tinted background columns = ORDER team
- Red-tinted background columns = CHAOS team
Each team has exactly 5 players shown as columns, with stat row labels in the center.

For each of the 10 players, extract:
- ign: the player name shown below or near the god portrait
- god: the god name shown (all-caps in some versions, e.g. "CABRAKAN")
- side: "order" if blue background, "chaos" if red background
- kills, deaths, assists: parsed from the KDA field (format "K/D/A", e.g. "11/10/9" means kills=11 deaths=10 assists=9)
- playerDamage: the PLAYER DAMAGE row value
- damageMitigated: the DAMAGE MITIGATED row value
- selfHealing: the SELF HEALING row value
- allyHealing: the ALLY HEALING row value
- structureDamage: the STRUCTURE DAMAGE row value

Use 0 for any value you cannot read clearly. Do not guess.

Return ONLY valid JSON, no markdown fences, no explanation:
{"players":[{"ign":"","god":"","side":"order","kills":0,"deaths":0,"assists":0,"playerDamage":0,"damageMitigated":0,"selfHealing":0,"allyHealing":0,"structureDamage":0}]}`;

export async function extractSmite2Details(imageBase64, mimeType = 'image/png') {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const raw = result.response.text().trim();
  // Strip markdown code fences if the model wraps output anyway
  const json = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(json);
}
