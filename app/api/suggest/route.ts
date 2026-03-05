import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { imageUrl, title } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

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
            source: { type: "url", url: imageUrl },
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
}
