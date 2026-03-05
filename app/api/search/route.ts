import { NextResponse } from "next/server";

const SITES =
  "site:dribbble.com OR site:behance.net OR site:awwwards.com OR site:mobbin.com OR site:godly.website OR site:siteinspire.com OR site:land-book.com OR site:lapa.ninja OR site:saasframe.io OR site:minimal.gallery OR site:bentogrids.com OR site:shoot.design OR site:supahero.io OR site:60fps.design OR site:collectui.com";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isListingPage(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname.toLowerCase();
    const host = hostname.replace("www.", "");
    if (/\/(search|tags?|categories?|topics?|explore|discover|popular|trending|following|feed)\b/.test(path)) return true;
    if (host === "behance.net" && !path.includes("/gallery/")) return true;
    if (host === "dribbble.com" && !/\/shots\/\d+/.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

type DDGImage = {
  image?: string;
  thumbnail?: string;
  url?: string;
  title?: string;
  hostname?: string;
};

async function searchDDG(q: string, page: number): Promise<{ images: DDGImage[]; hasMore: boolean } | null> {
  const encoded = encodeURIComponent(`${q} ${SITES}`);
  const start = (page - 1) * 100;

  // Step 1: get VQD token
  let vqd: string | undefined;
  try {
    const html = await fetch(
      `https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      }
    ).then((r) => r.text());

    // DDG embeds the vqd in the HTML in multiple possible formats
    const match =
      html.match(/vqd=['"]([^'"]+)['"]/) ||
      html.match(/"vqd"\s*:\s*"([^"]+)"/) ||
      html.match(/vqd=([^&"'\s]+)/);
    vqd = match?.[1];
  } catch {
    return null;
  }

  if (!vqd) return null;

  // Step 2: fetch images
  try {
    const imgUrl =
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encoded}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&s=${start}`;
    const data = await fetch(imgUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json, text/javascript",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://duckduckgo.com/",
      },
      signal: AbortSignal.timeout(10000),
    }).then((r) => r.json());

    const results: DDGImage[] = data?.results ?? [];
    return { images: results, hasMore: results.length >= 50 };
  } catch {
    return null;
  }
}

// Serper fallback (two parallel calls for coverage)
const SITES_A = "site:dribbble.com OR site:behance.net OR site:awwwards.com OR site:mobbin.com OR site:godly.website OR site:siteinspire.com OR site:land-book.com OR site:lapa.ninja";
const SITES_B = "site:saasframe.io OR site:minimal.gallery OR site:bentogrids.com OR site:shoot.design OR site:supahero.io OR site:60fps.design OR site:collectui.com";

async function fetchSerperGroup(apiKey: string, q: string, sites: string, page: number) {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: `${q} ${sites}`, num: 20, page, gl: "us", hl: "en" }),
    signal: AbortSignal.timeout(10000),
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

  // --- Try DuckDuckGo first ---
  const ddg = await searchDDG(q, page);

  if (ddg && ddg.images.length > 0) {
    const seen = new Set<string>();
    const images = ddg.images
      .filter((item) => {
        if (!item.image || !item.url) return false;
        if (seen.has(item.image)) return false;
        if (isListingPage(item.url)) return false;
        seen.add(item.image);
        return true;
      })
      .map((item) => ({
        imageUrl: item.image,
        thumbnailUrl: item.thumbnail ?? item.image,
        title: item.title ?? "",
        link: item.url,
        source: item.hostname ?? "",
      }));

    return NextResponse.json({ images, hasMore: ddg.hasMore, source: "ddg" });
  }

  // --- Fallback: Serper ---
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ images: [], hasMore: false, error: "No results available" });
  }

  const [rawA, rawB] = await Promise.all([
    fetchSerperGroup(apiKey, q, SITES_A, page),
    fetchSerperGroup(apiKey, q, SITES_B, page),
  ]);

  const raw = [...rawA, ...rawB];
  const hasMore = rawA.length >= 20 || rawB.length >= 20;

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
      thumbnailUrl: item.thumbnailUrl ?? item.imageUrl,
      title: item.title ?? "",
      link: item.link,
      source: item.source ?? "",
    }));

  return NextResponse.json({ images, hasMore, source: "serper" });
}
