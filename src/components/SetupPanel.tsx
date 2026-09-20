"use client";

import { useState } from "react";

interface Props {
  isConfigured: {
    bot: boolean;
    spotify: boolean;
    channel: boolean;
    cloudflare: boolean;
  };
}

interface ConfigItem {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  link?: string;
  linkLabel?: string;
  configured: boolean;
  isSecret?: boolean;
}

export default function SetupPanel({ isConfigured }: Props) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const configs: ConfigItem[] = [
    {
      key: "TELEGRAM_BOT_TOKEN",
      label: "Telegram Bot Token",
      description: "توکن ربات تلگرام از @BotFather",
      placeholder: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      link: "https://t.me/BotFather",
      linkLabel: "ساخت ربات",
      configured: isConfigured.bot,
      isSecret: true,
    },
    {
      key: "TELEGRAM_CHANNEL_ID",
      label: "Telegram Channel ID",
      description: "آیدی کانال آرشیو (ربات باید ادمین باشه)",
      placeholder: "@my_music_archive یا -100123456789",
      configured: isConfigured.channel,
    },
    {
      key: "SPOTIFY_CLIENT_ID",
      label: "Spotify Client ID",
      description: "از Spotify Developer Dashboard",
      placeholder: "abc123def456...",
      link: "https://developer.spotify.com/dashboard",
      linkLabel: "Spotify Dashboard",
      configured: isConfigured.spotify,
    },
    {
      key: "SPOTIFY_CLIENT_SECRET",
      label: "Spotify Client Secret",
      description: "از Spotify Developer Dashboard",
      placeholder: "xyz789...",
      configured: isConfigured.spotify,
      isSecret: true,
    },
    {
      key: "CF_ACCOUNT_ID",
      label: "Cloudflare Account ID",
      description: "برای استفاده از Cloudflare KV (اختیاری)",
      placeholder: "abc123...",
      link: "https://dash.cloudflare.com",
      linkLabel: "Cloudflare Dashboard",
      configured: isConfigured.cloudflare,
    },
    {
      key: "CF_API_TOKEN",
      label: "Cloudflare API Token",
      description: "با دسترسی KV Storage",
      placeholder: "your-cf-token...",
      configured: isConfigured.cloudflare,
      isSecret: true,
    },
    {
      key: "CF_KV_NAMESPACE_ID",
      label: "Cloudflare KV Namespace ID",
      description: "ID فضای ذخیره‌سازی KV",
      placeholder: "abc123...",
      configured: isConfigured.cloudflare,
    },
  ];

  const handleSetupWebhook = async () => {
    if (!webhookUrl) return;
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/setup-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await response.json() as { success: boolean; webhookUrl: string };

      if (data.success) {
        setResult(`✅ Webhook با موفقیت ثبت شد!\n📌 ${data.webhookUrl}`);
      } else {
        setResult("❌ خطا در ثبت webhook");
      }
    } catch {
      setResult("❌ خطا در اتصال به سرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-gray-900/60 border border-amber-800/30 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">
          ⚙️
        </div>
        <div>
          <h3 className="text-white font-semibold text-lg">راهنمای راه‌اندازی</h3>
          <p className="text-amber-400 text-sm">برخی تنظیمات کامل نشده‌اند</p>
        </div>
      </div>

      {/* Config Items */}
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        {configs.map((config) => (
          <div
            key={config.key}
            className={`p-4 rounded-xl border ${
              config.configured
                ? "bg-green-900/10 border-green-800/30"
                : "bg-gray-800/40 border-gray-700/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm ${config.configured ? "text-green-400" : ""}`}>
                    {config.configured ? "✅" : "⬜"}
                  </span>
                  <code className={`text-xs font-mono ${config.configured ? "text-green-300" : "text-gray-300"}`}>
                    {config.key}
                  </code>
                </div>
                <p className="text-gray-500 text-xs">{config.description}</p>
                {!config.configured && (
                  <p className="text-gray-600 text-xs mt-1 font-mono truncate">
                    {config.isSecret ? "••••••••" : config.placeholder}
                  </p>
                )}
              </div>
              {config.link && (
                <a
                  href={config.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-xs hover:text-blue-300 shrink-0"
                >
                  {config.linkLabel} →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* .env Instructions */}
      <div className="p-4 rounded-xl bg-gray-800/60 border border-gray-700/50 mb-6">
        <p className="text-gray-400 text-sm mb-3">
          🔧 این متغیرها رو به فایل <code className="text-green-400 bg-gray-900 px-1 rounded">.env</code> اضافه کن:
        </p>
        <pre className="text-xs text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=@your_channel_or_-100xxxxx
BOT_USERNAME=YourBotUsername
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
WEBHOOK_SECRET_TOKEN=any_random_secret_string

# Cloudflare KV (اختیاری - برای کش سریع)
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_KV_NAMESPACE_ID=your_kv_namespace_id

# YouTube API (اختیاری)
YOUTUBE_API_KEY=your_youtube_api_key`}
        </pre>
      </div>

      {/* Webhook Setup */}
      {isConfigured.bot && (
        <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-800/30">
          <p className="text-blue-400 font-medium text-sm mb-3">📡 ثبت Webhook تلگرام</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-domain.com"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSetupWebhook}
              disabled={loading || !webhookUrl}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "..." : "ثبت"}
            </button>
          </div>
          {result && (
            <p className="text-xs mt-2 text-gray-400 whitespace-pre-line">{result}</p>
          )}
          <p className="text-gray-600 text-xs mt-2">
            آدرس سرور خودت رو وارد کن. ربات از <code>/api/webhook</code> استفاده می‌کنه.
          </p>
        </div>
      )}
    </div>
  );
}
