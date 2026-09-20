/**
 * Stats API - آمار ربات
 */

import { NextResponse } from "next/server";
import { getStats } from "@/lib/trackService";
import { isCloudflareConfigured } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await getStats();

    return NextResponse.json({
      ...stats,
      cloudflareKV: isCloudflareConfigured(),
      botConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      spotifyConfigured:
        !!process.env.SPOTIFY_CLIENT_ID &&
        !!process.env.SPOTIFY_CLIENT_SECRET,
      channelConfigured: !!process.env.TELEGRAM_CHANNEL_ID,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
