/**
 * Telegram Webhook Endpoint
 * تلگرام به این آدرس POST می‌کنه
 */

import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegramBot";
import type { TelegramUpdate } from "@/lib/telegramBot";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // ۵ دقیقه برای دانلود

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // بررسی secret token برای امنیت
    const secretToken = process.env.WEBHOOK_SECRET_TOKEN;
    if (secretToken) {
      const headerToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (headerToken !== secretToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json() as TelegramUpdate;

    // پردازش async - جواب سریع به تلگرام بده
    // (تلگرام ۶۰ ثانیه صبر می‌کنه)
    handleTelegramUpdate(body).catch((err) => {
      console.error("Webhook processing error:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// برای تست webhook از مرورگر
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "Telegram webhook is active",
    configured: !!process.env.TELEGRAM_BOT_TOKEN,
  });
}
