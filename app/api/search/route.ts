import { NextResponse } from "next/server";

const SITES =
  "site:dribbble.com OR site:behance.net OR site:awwwards.com OR site:mobbin.com OR site:godly.website OR site:siteinspire.com OR site:land-book.com OR site:lapa.ninja OR site:saasframe.io OR site:minimal.gallery OR site:bentogrids.com OR site:shoot.design OR site:supahero.io OR site:60fps.design OR site:collectui.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${q} ${SITES}`,
      num: 20,
      page,
      gl: "us",
      hl: "en",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();

  // Normalize to a flat array of image results
  const images = (data.images ?? []).map((item: {
    imageUrl?: string;
    thumbnailUrl?: string;
    title?: string;
    link?: string;
    source?: string;
  }) => ({
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    title: item.title,
    link: item.link,
    source: item.source,
  }));

  return NextResponse.json({ images });
}
