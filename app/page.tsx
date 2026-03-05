"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type ImageResult = {
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  link: string;
  source: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<ImageResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const currentQueryRef = useRef("");

  const fetchImages = useCallback(async (q: string, p: number, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${p}`);
      const data = await res.json();
      const newImages: ImageResult[] = data.images ?? [];
      if (append) {
        setImages((prev) => [...prev, ...newImages]);
      } else {
        setImages(newImages);
      }
      setHasMore(data.hasMore ?? newImages.length === 20);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    currentQueryRef.current = query.trim();
    setPage(1);
    setSearched(true);
    setImages([]);
    setHasMore(false);
    setFailedImages(new Set());
    fetchImages(query.trim(), 1, false);
  };

  // Load more pages
  useEffect(() => {
    if (page === 1) return;
    fetchImages(currentQueryRef.current, page, true);
  }, [page, fetchImages]);

  const handleLoadMore = () => setPage((p) => p + 1);

  const visibleImages = images.filter((img) => !failedImages.has(img.imageUrl));

  return (
    <main className="min-h-screen bg-black">
      {/* Header / Search bar — sticky on top once searched */}
      <div
        className={`
          transition-all duration-500
          ${searched
            ? "sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10 px-6 py-3 flex items-center gap-4 relative"
            : "flex flex-col items-center justify-center min-h-screen px-6"}
        `}
      >
        {!searched && (
          <h1 className="text-5xl tracking-tight mb-8 text-white" style={{ fontFamily: "var(--font-playfair)", fontWeight: 400 }}>
            Inspiraaation!
          </h1>
        )}
        {searched && (
          <span className="text-white text-4xl tracking-tight shrink-0" style={{ fontFamily: "var(--font-playfair)", fontWeight: 400 }}>
            Inspiraaation!
          </span>
        )}
        <form
          onSubmit={handleSearch}
          className={searched ? "absolute left-1/2 -translate-x-1/2 w-full max-w-2xl px-4" : "w-full max-w-2xl"}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search design inspiration..."
            autoFocus
            className="w-full bg-white/10 text-white placeholder-white/40 rounded-full px-5 py-3 text-sm outline-none focus:bg-white/15 transition-colors border border-white/10 focus:border-white/30"
          />
        </form>
      </div>

      {/* Grid */}
      {searched && (
        <div className="px-2 pt-3 pb-10">
          {/* Skeleton on first load */}
          {loading && images.length === 0 && (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="break-inside-avoid mb-2 rounded-lg bg-white/10 animate-pulse"
                  style={{ height: `${180 + (i % 4) * 60}px` }}
                />
              ))}
            </div>
          )}

          {/* Masonry */}
          {visibleImages.length > 0 && (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2">
              {visibleImages.map((img, i) => (
                <div
                  key={`${img.imageUrl}-${i}`}
                  className="break-inside-avoid mb-2 group relative cursor-pointer"
                  onClick={() => window.open(img.link, "_blank", "noopener")}
                >
                  <img
                    src={img.imageUrl || img.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-lg object-cover transition-opacity duration-300 group-hover:opacity-80"
                    onError={() =>
                      setFailedImages((prev) => new Set([...prev, img.imageUrl]))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && images.length === 0 && (
            <p className="text-center text-white/30 text-sm mt-20">
              No results found. Try a different search.
            </p>
          )}

          {/* Load more button */}
          {hasMore && !loading && (
            <div className="flex justify-center py-12">
              <button
                onClick={handleLoadMore}
                className="text-white/40 text-sm hover:text-white transition-colors"
              >
                Ver más imágenes →
              </button>
            </div>
          )}

          {/* Loading more spinner */}
          {loading && images.length > 0 && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
