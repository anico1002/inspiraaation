import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

function titleFallback(title: string): string {
  return title
    .replace(/by\s+[\w\s.]+$/i, "")
    .replace(/on\s+(dribbble|behance|awwwards|mobbin|figma)/gi, "")
    .replace(/[|–—\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

export async function POST(request: Request) {
  const { imageUrl, title } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ query: titleFallback(title) });

  // Fetch image server-side and convert to base64 (CDN URLs may be inaccessible from Anthropic)
  let base64: string;
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
  try {
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!imgRes.ok) throw new Error("fetch failed");
    const ct = imgRes.headers.get("content-type") ?? "";
    if (ct.includes("png")) mediaType = "image/png";
    else if (ct.includes("webp")) mediaType = "image/webp";
    else if (ct.includes("gif")) mediaType = "image/gif";
    const buf = await imgRes.arrayBuffer();
    base64 = Buffer.from(buf).toString("base64");
  } catch {
    return NextResponse.json({ query: titleFallback(title) });
  }

  try {
    const client = new Anthropic({ apiKey });
    const prompt = `You are a design expert. Analyze this image and identify its MOST DISTINCTIVE visual attributes across these dimensions:

1. COLOR: Specific hues (e.g. "electric blue", "sage green", "warm coral" — never just "blue" or "green")
2. THEME: dark mode / light mode / colorful / monochrome
3. UI TYPE: mobile app / web dashboard / landing page / marketing / branding / illustration / icon set
4. VISUAL STYLE: minimal / glassmorphism / neumorphism / flat / gradient-heavy / brutalist / editorial / 3D / illustrated / retro
5. LAYOUT: card grid / hero section / split screen / full-bleed / tabular / timeline / feed
6. DISTINCTIVE ELEMENTS: the 1-2 most unique visual components or patterns visible
7. MOOD/SECTOR: premium / playful / corporate / startup / health / fintech / e-commerce / productivity / social

Combine the MOST DISTINCTIVE attributes (those that make this image unique, not generic design terms) into a search query of 10-14 words.

Image title for context: "${title}"

Return ONLY the search query. No explanation, no punctuation, no quotes.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const query = (msg.content[0] as { text: string }).text.trim();
    return NextResponse.json({ query });
  } catch {
    return NextResponse.json({ query: titleFallback(title) });
  }
}
