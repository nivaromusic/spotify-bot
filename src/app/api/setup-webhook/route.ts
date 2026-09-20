/**
 * Setup Webhook API
 * برای ثبت webhook آدرس در تلگرام
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_TOKEN;

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 500 }
    );
  }

  const body = await request.json() as { webhookUrl?: string };
  const webhookUrl = body.webhookUrl;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "webhookUrl is required" },
      { status: 400 }
    );
  }

  const fullWebhookUrl = `${webhookUrl}/api/webhook`;

  const payload: Record<string, unknown> = {
    url: fullWebhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  };

  if (WEBHOOK_SECRET) {
    payload.secret_token = WEBHOOK_SECRET;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  return NextResponse.json({
    success: response.ok,
    webhookUrl: fullWebhookUrl,
    telegramResponse: result,
  });
}

export async function GET(): Promise<NextResponse> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 500 }
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
  );
  const info = await response.json();

  return NextResponse.json(info);
}
