"use client";

import { useState, useEffect, useCallback } from "react";

interface Track {
  id: number;
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  coverUrl: string | null;
  durationMs: number | null;
  telegramFileId: string | null;
  downloadCount: number | null;
  createdAt: string | null;
}

interface TracksResponse {
  tracks: Track[];
  total: number;
  page: number;
  limit: number;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fa-IR");
}

export default function TracksList() {
  const [data, setData] = useState<TracksResponse | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        ...(query ? { q: query } : {}),
      });

      const res = await fetch(`/api/tracks?${params}`);
      const json = await res.json() as TracksResponse;
      setData(json);
    } catch {
      console.error("Failed to fetch tracks");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTracks();
  };

  const totalPages = data ? Math.ceil(data.total / 12) : 0;

  return (
    <div className="rounded-2xl bg-gray-900/60 border border-gray-800/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          📚 آرشیو آهنگ‌ها
          {data && (
            <span className="text-sm text-gray-500 font-normal">
              ({data.total.toLocaleString("fa-IR")} آهنگ)
            </span>
          )}
        </h3>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 جستجو در آرشیو..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          جستجو
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setPage(1); }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            ✕
          </button>
        )}
      </form>

      {/* Tracks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse h-24 rounded-xl bg-gray-800/50" />
          ))}
        </div>
      ) : data?.tracks.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🎵</p>
          <p className="text-lg">
            {query ? `هیچ آهنگی برای "${query}" پیدا نشد` : "هنوز آهنگی در آرشیو نیست"}
          </p>
          <p className="text-sm mt-2">اولین آهنگ رو از ربات تلگرام دانلود کن!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/70 transition-colors group"
            >
              {/* Cover */}
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                {track.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.coverUrl}
                    alt={track.trackName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🎵
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{track.trackName}</p>
                <p className="text-gray-400 text-xs truncate">{track.artistName}</p>
                <div className="flex items-center gap-2 mt-1">
                  {track.durationMs && (
                    <span className="text-gray-600 text-xs">{formatDuration(track.durationMs)}</span>
                  )}
                  {track.downloadCount && track.downloadCount > 0 && (
                    <span className="text-green-600 text-xs">↓{track.downloadCount}</span>
                  )}
                  {track.createdAt && (
                    <span className="text-gray-700 text-xs">{formatDate(track.createdAt)}</span>
                  )}
                </div>
              </div>

              {/* File ID Badge */}
              <div className="shrink-0">
                {track.telegramFileId ? (
                  <span className="text-xs bg-green-900/40 text-green-500 border border-green-800/50 px-2 py-0.5 rounded-full">
                    📁
                  </span>
                ) : (
                  <span className="text-xs bg-gray-800 text-gray-600 border border-gray-700 px-2 py-0.5 rounded-full">
                    ⏳
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
          >
            ← قبلی
          </button>
          <span className="text-gray-500 text-sm">
            صفحه {page} از {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
          >
            بعدی →
          </button>
        </div>
      )}
    </div>
  );
}
