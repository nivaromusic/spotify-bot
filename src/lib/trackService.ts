/**
 * Track Service - مدیریت آهنگ‌ها در دیتابیس و Cloudflare KV
 */

import { db } from "@/db";
import { tracks, userRequests } from "@/db/schema";
import { eq, sql, ilike, or } from "drizzle-orm";
import {
  getFromCloudflareKV,
  setInCloudflareKV,
  makeTrackKey,
} from "./cloudflare";

// interface محلی (به‌جای spotify.ts)
export interface TrackInfo {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  coverUrl: string;
  durationMs: number;
  spotifyUrl: string;
}

export interface StoredTrack {
  id: number;
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  coverUrl: string | null;
  durationMs: number | null;
  telegramFileId: string | null;
  channelMessageId: number | null;
  downloadCount: number | null;
}

// پیدا کردن آهنگ با Spotify ID (یا yt:xxx)
export async function findTrackBySpotifyId(
  spotifyId: string
): Promise<StoredTrack | null> {
  // ۱. از Cloudflare KV (کش سریع)
  const cacheKey = makeTrackKey(spotifyId);
  const cached = await getFromCloudflareKV(cacheKey);

  if (cached && cached.telegramFileId) {
    const dbTrack = await db
      .select()
      .from(tracks)
      .where(eq(tracks.spotifyId, spotifyId))
      .limit(1);

    if (dbTrack.length > 0) {
      await db
        .update(tracks)
        .set({ downloadCount: sql`${tracks.downloadCount} + 1` })
        .where(eq(tracks.spotifyId, spotifyId));

      return dbTrack[0] as StoredTrack;
    }
  }

  // ۲. از PostgreSQL
  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.spotifyId, spotifyId))
    .limit(1);

  if (result.length === 0) return null;

  const track = result[0];

  if (track.telegramFileId && track.channelMessageId) {
    await setInCloudflareKV(
      cacheKey,
      {
        telegramFileId: track.telegramFileId,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName || "",
        coverUrl: track.coverUrl || "",
        durationMs: track.durationMs || 0,
        channelMessageId: track.channelMessageId,
        cachedAt: new Date().toISOString(),
      },
      60 * 60 * 24 * 30
    );
  }

  return track as StoredTrack;
}

// ذخیره آهنگ جدید
export async function saveTrack(
  trackInfo: TrackInfo,
  telegramFileId: string,
  channelMessageId: number
): Promise<StoredTrack> {
  const result = await db
    .insert(tracks)
    .values({
      spotifyId: trackInfo.spotifyId,
      trackName: trackInfo.trackName,
      artistName: trackInfo.artistName,
      albumName: trackInfo.albumName,
      coverUrl: trackInfo.coverUrl,
      durationMs: trackInfo.durationMs,
      telegramFileId,
      channelMessageId,
      downloadCount: 1,
    })
    .onConflictDoUpdate({
      target: tracks.spotifyId,
      set: {
        telegramFileId,
        channelMessageId,
        downloadCount: sql`${tracks.downloadCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  const saved = result[0] as StoredTrack;

  const cacheKey = makeTrackKey(trackInfo.spotifyId);
  await setInCloudflareKV(
    cacheKey,
    {
      telegramFileId,
      trackName: trackInfo.trackName,
      artistName: trackInfo.artistName,
      albumName: trackInfo.albumName,
      coverUrl: trackInfo.coverUrl,
      durationMs: trackInfo.durationMs,
      channelMessageId,
      cachedAt: new Date().toISOString(),
    },
    60 * 60 * 24 * 30
  );

  return saved;
}

// جستجو در دیتابیس
export async function searchTracksInDb(
  query: string
): Promise<StoredTrack[]> {
  const results = await db
    .select()
    .from(tracks)
    .where(
      or(
        ilike(tracks.trackName, `%${query}%`),
        ilike(tracks.artistName, `%${query}%`)
      )
    )
    .limit(5);

  return results as StoredTrack[];
}

// ثبت درخواست کاربر
export async function logUserRequest(data: {
  telegramUserId: number;
  telegramUsername?: string;
  spotifyUrl?: string;
  searchQuery?: string;
  trackId?: number;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
}) {
  await db.insert(userRequests).values({
    telegramUserId: data.telegramUserId,
    telegramUsername: data.telegramUsername,
    spotifyUrl: data.spotifyUrl,
    searchQuery: data.searchQuery,
    trackId: data.trackId,
    status: data.status,
    errorMessage: data.errorMessage,
  });
}

// آمار
export async function getStats() {
  const [trackCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tracks);

  const [requestCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRequests);

  const topTracks = await db
    .select({
      trackName: tracks.trackName,
      artistName: tracks.artistName,
      downloadCount: tracks.downloadCount,
    })
    .from(tracks)
    .orderBy(sql`${tracks.downloadCount} desc`)
    .limit(5);

  return {
    totalTracks: Number(trackCount.count),
    totalRequests: Number(requestCount.count),
    topTracks,
  };
}
