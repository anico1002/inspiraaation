import { NextResponse } from "next/server";

const SITES_A = "site:dribbble.com OR site:behance.net OR site:awwwards.com OR site:mobbin.com OR site:godly.website OR site:siteinspire.com OR site:land-book.com OR site:lapa.ninja";
const SITES_B = "site:saasframe.io OR site:minimal.gallery OR site:bentogrids.com OR site:shoot.design OR site:supahero.io OR site:60fps.design OR site:collectui.com";

function isListingPage(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname.toLowerCase();
    const host = hostname.replace("www.", "");
    if (/\/(search|tags?|categories?|topics?|collections?|explore|discover|popular|trending|following|feed)\b/.test(path)) return true;
    if (host === "behance.net" && !path.includes("/gallery/")) return true;
    if (host === "dribbble.com" && !/\/shots\/\d+/.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

async function fetchSerper(apiKey: string, q: string, sites: string, page: number) {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: `${q} ${sites}`, num: 20, page, gl: "us", hl: "en" }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.images ?? []) as { imageUrl?: string; thumbnailUrl?: string; title?: string; link?: string; source?: string }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  // Two parallel calls covering all 15 sites → up to 40 raw results per page
  const [rawA, rawB] = await Promise.all([
    fetchSerper(apiKey, q, SITES_A, page),
    fetchSerper(apiKey, q, SITES_B, page),
  ]);

  const raw = [...rawA, ...rawB];
  const hasMore = rawA.length >= 20 || rawB.length >= 20;

  // Deduplicate by imageUrl
  const seen = new Set<string>();
  const images = raw
    .filter((item) => {
      if (!item.imageUrl || !item.link) return false;
      if (seen.has(item.imageUrl)) return false;
      if (isListingPage(item.link)) return false;
      seen.add(item.imageUrl);
      return true;
    })
    .map((item) => ({
      imageUrl: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl,
      title: item.title,
      link: item.link,
      source: item.source,
    }));

  return NextResponse.json({ images, hasMore });
}
