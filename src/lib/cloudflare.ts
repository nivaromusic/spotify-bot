/**
 * Cloudflare KV Integration
 * استفاده از Cloudflare KV برای کش سریع file_id های تلگرام
 * و جلوگیری از دانلود مجدد آهنگ‌های تکراری
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID;

const CF_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}`;

interface CachedTrack {
  telegramFileId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  coverUrl: string;
  durationMs: number;
  channelMessageId: number;
  cachedAt: string;
}

// بررسی آیا Cloudflare KV تنظیم شده
export function isCloudflareConfigured(): boolean {
  return !!(CF_ACCOUNT_ID && CF_API_TOKEN && CF_KV_NAMESPACE_ID);
}

// خواندن از Cloudflare KV
export async function getFromCloudflareKV(
  key: string
): Promise<CachedTrack | null> {
  if (!isCloudflareConfigured()) return null;

  try {
    const response = await fetch(`${CF_BASE_URL}/values/${key}`, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
    });

    if (!response.ok) return null;

    const text = await response.text();
    return JSON.parse(text) as CachedTrack;
  } catch {
    return null;
  }
}

// نوشتن در Cloudflare KV
export async function setInCloudflareKV(
  key: string,
  value: CachedTrack,
  expirationTtl?: number
): Promise<boolean> {
  if (!isCloudflareConfigured()) return false;

  try {
    const body: Record<string, unknown> = {
      key,
      value: JSON.stringify(value),
    };

    if (expirationTtl) {
      body.expiration_ttl = expirationTtl;
    }

    const response = await fetch(`${CF_BASE_URL}/bulk`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([body]),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// حذف از Cloudflare KV
export async function deleteFromCloudflareKV(key: string): Promise<boolean> {
  if (!isCloudflareConfigured()) return false;

  try {
    const response = await fetch(`${CF_BASE_URL}/values/${key}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

// لیست کردن کلیدها
export async function listCloudflareKVKeys(
  prefix?: string
): Promise<string[]> {
  if (!isCloudflareConfigured()) return [];

  try {
    const url = prefix
      ? `${CF_BASE_URL}/keys?prefix=${prefix}`
      : `${CF_BASE_URL}/keys`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      result: Array<{ name: string }>;
    };
    return data.result.map((k) => k.name);
  } catch {
    return [];
  }
}

// ساخت کلید برای یک آهنگ اسپوتیفای
export function makeTrackKey(spotifyId: string): string {
  return `track:${spotifyId}`;
}
