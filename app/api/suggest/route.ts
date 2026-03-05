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
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Design image titled: "${title}". Generate a 4-6 word search query to find visually similar designs on Dribbble/Behance/Awwwards. Focus on: visual style, colors, UI type, layout, mood. Return ONLY the query, nothing else.`,
            },
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
