/**
 * Tracks API - لیست آهنگ‌های آرشیو
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { desc, ilike, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    let dbQuery = db.select().from(tracks);

    if (query) {
      dbQuery = dbQuery.where(
        or(
          ilike(tracks.trackName, `%${query}%`),
          ilike(tracks.artistName, `%${query}%`),
          ilike(tracks.albumName, `%${query}%`)
        )
      ) as typeof dbQuery;
    }

    const results = await dbQuery
      .orderBy(desc(tracks.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tracks);

    return NextResponse.json({
      tracks: results,
      total: Number(countResult.count),
      page,
      limit,
    });
  } catch (err) {
    console.error("Tracks API error:", err);
    return NextResponse.json({ error: "Failed to get tracks" }, { status: 500 });
  }
}
