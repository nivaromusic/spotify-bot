/**
 * Telegram Bot Handler - منطق اصلی ربات
 * این فایل پردازش پیام‌های تلگرام رو انجام می‌ده
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { extractSpotifyTrackId, getTrackInfo, searchSpotify, formatDuration } from "./spotify";
import { searchYouTube, downloadFromYouTube } from "./youtube";
import {
  findTrackBySpotifyId,
  saveTrack,
  searchTracksInDb,
  logUserRequest,
} from "./trackService";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ARCHIVE_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID; // مثلاً @my_music_archive یا -100123456789

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ارسال پیام متنی
async function sendMessage(
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML",
  replyMarkup?: object
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ویرایش پیام
async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML"
): Promise<void> {
  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
    }),
  });
}

// ارسال عکس
async function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string
): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
    }),
  });
}

// ارسال audio از file_id (بدون آپلود مجدد)
async function sendAudioFromFileId(
  chatId: number | string,
  fileId: string,
  caption: string
): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendAudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      audio: fileId,
      caption,
      parse_mode: "HTML",
    }),
  });
}

// آپلود فایل صوتی و ارسال به کانال و کاربر
async function uploadAndSendAudio(
  filePath: string,
  targetChatId: number | string,
  title: string,
  performer: string,
  caption: string,
  durationSeconds?: number
): Promise<{ fileId: string; messageId: number } | null> {
  const formData = new FormData();
  formData.append("chat_id", String(targetChatId));
  formData.append("title", title);
  formData.append("performer", performer);
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  if (durationSeconds) formData.append("duration", String(durationSeconds));

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: "audio/mpeg" });
  formData.append("audio", blob, fileName);

  const response = await fetch(`${TELEGRAM_API}/sendAudio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    console.error("Upload failed:", await response.text());
    return null;
  }

  const data = await response.json() as {
    ok: boolean;
    result: {
      message_id: number;
      audio: { file_id: string };
    };
  };

  if (!data.ok) return null;

  return {
    fileId: data.result.audio.file_id,
    messageId: data.result.message_id,
  };
}

// فوروارد پیام از کانال به کاربر
async function forwardMessage(
  fromChatId: string | number,
  toChatId: string | number,
  messageId: number
): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from_chat_id: fromChatId,
      chat_id: toChatId,
      message_id: messageId,
    }),
  });

  return response.ok;
}

// ارسال پیام در حال تایپ
async function sendChatAction(
  chatId: number | string,
  action: "typing" | "upload_audio" | "record_audio" = "typing"
): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

// ارسال پیام وضعیت
async function sendStatusMessage(
  chatId: number | string,
  text: string
): Promise<number> {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  const data = await response.json() as { result: { message_id: number } };
  return data.result.message_id;
}

// حذف پیام
async function deleteMessage(
  chatId: number | string,
  messageId: number
): Promise<void> {
  await fetch(`${TELEGRAM_API}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

// پردازش اصلی درخواست آهنگ
export async function processSpotifyRequest(
  chatId: number,
  userId: number,
  username: string | undefined,
  spotifyUrl: string
): Promise<void> {
  // استخراج Spotify Track ID
  const trackId = extractSpotifyTrackId(spotifyUrl);
  if (!trackId) {
    await sendMessage(
      chatId,
      "❌ لینک اسپوتیفای معتبر نیست!\n\nلطفاً یک لینک آهنگ اسپوتیفای بفرستید:\n<code>https://open.spotify.com/track/...</code>"
    );
    return;
  }

  // ارسال پیام وضعیت
  const statusMsgId = await sendStatusMessage(
    chatId,
    "🔍 در حال جستجو در آرشیو..."
  );

  await logUserRequest({
    telegramUserId: userId,
    telegramUsername: username,
    spotifyUrl,
    status: "pending",
  });

  try {
    // ۱. بررسی آرشیو (دیتابیس + Cloudflare KV)
    const existingTrack = await findTrackBySpotifyId(trackId);

    if (existingTrack?.telegramFileId) {
      // آهنگ قبلاً دانلود شده - ارسال مستقیم
      await editMessage(
        chatId,
        statusMsgId,
        "✅ آهنگ در آرشیو پیدا شد! در حال ارسال..."
      );

      const caption = formatCaption(
        existingTrack.trackName,
        existingTrack.artistName,
        existingTrack.albumName || "",
        existingTrack.durationMs || 0,
        true
      );

      await sendAudioFromFileId(chatId, existingTrack.telegramFileId, caption);

      await deleteMessage(chatId, statusMsgId);
      await logUserRequest({
        telegramUserId: userId,
        telegramUsername: username,
        spotifyUrl,
        trackId: existingTrack.id,
        status: "success",
      });
      return;
    }

    // ۲. گرفتن اطلاعات آهنگ از Spotify
    await editMessage(
      chatId,
      statusMsgId,
      "🎵 در حال دریافت اطلاعات آهنگ از اسپوتیفای..."
    );

    const trackInfo = await getTrackInfo(trackId);

    await editMessage(
      chatId,
      statusMsgId,
      `🎵 <b>${trackInfo.trackName}</b>\n👤 ${trackInfo.artistName}\n\n⬇️ در حال دانلود...`
    );

    // ۳. جستجو در یوتیوب و دانلود
    const searchQuery = `${trackInfo.artistName} - ${trackInfo.trackName}`;
    const youtubeResult = await searchYouTube(searchQuery);

    if (!youtubeResult) {
      await editMessage(
        chatId,
        statusMsgId,
        "❌ متأسفم! آهنگ رو توی یوتیوب پیدا نکردم."
      );
      await logUserRequest({
        telegramUserId: userId,
        telegramUsername: username,
        spotifyUrl,
        status: "failed",
        errorMessage: "YouTube search failed",
      });
      return;
    }

    // ۴. ایجاد پوشه موقت و دانلود
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgbot-"));
    const safeFilename = `${trackInfo.artistName} - ${trackInfo.trackName}`
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "")
      .substring(0, 80);

    await sendChatAction(chatId, "upload_audio");

    let audioFilePath: string | null = null;
    try {
      audioFilePath = await downloadFromYouTube(
        youtubeResult.url,
        tmpDir,
        safeFilename
      );
    } catch (err) {
      console.error("Download error:", err);
      await editMessage(
        chatId,
        statusMsgId,
        "❌ خطا در دانلود آهنگ. لطفاً دوباره امتحان کنید."
      );
      await logUserRequest({
        telegramUserId: userId,
        telegramUsername: username,
        spotifyUrl,
        status: "failed",
        errorMessage: String(err),
      });
      // پاکسازی پوشه موقت
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      await editMessage(
        chatId,
        statusMsgId,
        "❌ فایل صوتی دانلود نشد. لطفاً دوباره امتحان کنید."
      );
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    // ۵. آپلود به کانال آرشیو
    await editMessage(
      chatId,
      statusMsgId,
      "📤 در حال آپلود در کانال آرشیو..."
    );

    const caption = formatCaption(
      trackInfo.trackName,
      trackInfo.artistName,
      trackInfo.albumName,
      trackInfo.durationMs,
      false
    );

    const durationSeconds = Math.floor(trackInfo.durationMs / 1000);

    // اول به کانال آرشیو آپلود می‌کنیم
    let telegramFileId = "";
    let channelMsgId = 0;

    if (ARCHIVE_CHANNEL_ID) {
      const uploadResult = await uploadAndSendAudio(
        audioFilePath,
        ARCHIVE_CHANNEL_ID,
        trackInfo.trackName,
        trackInfo.artistName,
        caption,
        durationSeconds
      );

      if (uploadResult) {
        telegramFileId = uploadResult.fileId;
        channelMsgId = uploadResult.messageId;
      }
    }

    if (!telegramFileId) {
      // اگر کانال تنظیم نشده، مستقیم به کاربر ارسال می‌کنیم
      const uploadResult = await uploadAndSendAudio(
        audioFilePath,
        chatId,
        trackInfo.trackName,
        trackInfo.artistName,
        caption,
        durationSeconds
      );

      if (!uploadResult) {
        await editMessage(chatId, statusMsgId, "❌ خطا در آپلود فایل.");
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return;
      }

      telegramFileId = uploadResult.fileId;
    } else {
      // ارسال به کاربر از روی file_id کانال
      await sendAudioFromFileId(chatId, telegramFileId, caption);
    }

    // ۶. ذخیره در دیتابیس + Cloudflare KV
    const savedTrack = await saveTrack(
      trackInfo,
      telegramFileId,
      channelMsgId
    );

    await logUserRequest({
      telegramUserId: userId,
      telegramUsername: username,
      spotifyUrl,
      trackId: savedTrack.id,
      status: "success",
    });

    // ۷. حذف پیام وضعیت
    await deleteMessage(chatId, statusMsgId);

    // ۸. پاکسازی فایل موقت
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.error("processSpotifyRequest error:", err);
    await editMessage(
      chatId,
      statusMsgId,
      "❌ خطایی رخ داد. لطفاً دوباره امتحان کنید."
    );
    await logUserRequest({
      telegramUserId: userId,
      telegramUsername: username,
      spotifyUrl,
      status: "failed",
      errorMessage: String(err),
    });
  }
}

// جستجوی آهنگ (برای وقتی کاربر اسم آهنگ می‌فرسته)
export async function processSearchRequest(
  chatId: number,
  userId: number,
  username: string | undefined,
  query: string
): Promise<void> {
  // اول در دیتابیس جستجو می‌کنیم
  const localResults = await searchTracksInDb(query);

  if (localResults.length > 0) {
    // نتایج محلی پیدا شد
    const buttons = localResults.map((track) => [
      {
        text: `🎵 ${track.trackName} - ${track.artistName}`,
        callback_data: `local:${track.spotifyId}`,
      },
    ]);

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔍 نتایج جستجو برای: <b>${query}</b>\n\n${localResults.length} آهنگ در آرشیو پیدا شد:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: buttons,
        },
      }),
    });
    return;
  }

  // جستجو در Spotify
  const statusMsgId = await sendStatusMessage(
    chatId,
    `🔍 در حال جستجو در اسپوتیفای: <b>${query}</b>...`
  );

  try {
    const spotifyResults = await searchSpotify(query);

    if (spotifyResults.length === 0) {
      await editMessage(
        chatId,
        statusMsgId,
        `❌ هیچ آهنگی برای "<b>${query}</b>" پیدا نشد.`
      );
      return;
    }

    const buttons = spotifyResults.map((track) => [
      {
        text: `🎵 ${track.trackName} - ${track.artistName}`,
        callback_data: `spotify:${track.spotifyId}`,
      },
    ]);

    await editMessage(
      chatId,
      statusMsgId,
      `🔍 نتایج جستجو برای: <b>${query}</b>\n\n${spotifyResults.length} آهنگ پیدا شد:`
    );

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "یکی از آهنگ‌های زیر رو انتخاب کن:",
        reply_markup: {
          inline_keyboard: buttons,
        },
      }),
    });
  } catch (err) {
    console.error("Search error:", err);
    await editMessage(
      chatId,
      statusMsgId,
      "❌ خطا در جستجو. لطفاً از لینک مستقیم اسپوتیفای استفاده کنید."
    );
  }
}

// پردازش callback query (وقتی کاربر روی دکمه می‌زنه)
export async function processCallbackQuery(
  callbackQueryId: string,
  chatId: number,
  userId: number,
  username: string | undefined,
  data: string
): Promise<void> {
  // جواب دادن به callback
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: "⏳ در حال پردازش...",
    }),
  });

  const [type, spotifyId] = data.split(":");

  if (type === "local") {
    // آهنگ از آرشیو محلی
    const track = await findTrackBySpotifyId(spotifyId);
    if (track?.telegramFileId) {
      const caption = formatCaption(
        track.trackName,
        track.artistName,
        track.albumName || "",
        track.durationMs || 0,
        true
      );
      await sendAudioFromFileId(chatId, track.telegramFileId, caption);
    }
  } else if (type === "spotify") {
    // دانلود از اسپوتیفای
    const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`;
    await processSpotifyRequest(chatId, userId, username, spotifyUrl);
  }
}

// فرمت کردن کپشن آهنگ
function formatCaption(
  trackName: string,
  artistName: string,
  albumName: string,
  durationMs: number,
  fromArchive: boolean
): string {
  const duration = durationMs ? formatDuration(durationMs) : "";
  const archiveBadge = fromArchive ? "♻️ از آرشیو" : "🆕 تازه دانلود";

  return (
    `🎵 <b>${trackName}</b>\n` +
    `👤 ${artistName}\n` +
    (albumName ? `💿 ${albumName}\n` : "") +
    (duration ? `⏱ ${duration}\n` : "") +
    `\n${archiveBadge} | @${process.env.BOT_USERNAME || "MusicArchiveBot"}`
  );
}

// پردازش پیام‌های ورودی از webhook
export async function handleTelegramUpdate(
  update: TelegramUpdate
): Promise<void> {
  // پردازش callback query
  if (update.callback_query) {
    const { id, from, message, data } = update.callback_query;
    if (message && data) {
      await processCallbackQuery(
        id,
        message.chat.id,
        from.id,
        from.username,
        data
      );
    }
    return;
  }

  if (!update.message) return;

  const { message } = update;
  const chatId = message.chat.id;
  const userId = message.from?.id || 0;
  const username = message.from?.username;
  const text = message.text || "";

  // دستور /start
  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      `🎵 <b>به ربات موزیک خوش اومدی!</b>\n\n` +
        `می‌تونی:\n` +
        `• لینک اسپوتیفای بفرستی 🔗\n` +
        `• اسم آهنگ رو جستجو کنی 🔍\n\n` +
        `<b>مثال:</b>\n` +
        `<code>https://open.spotify.com/track/...</code>\n` +
        `یا فقط اسم آهنگ رو بنویس:\n` +
        `<code>Bohemian Rhapsody</code>\n\n` +
        `📦 آرشیو کامل موزیک در کانال ما!`
    );
    return;
  }

  // دستور /help
  if (text === "/help") {
    await sendMessage(
      chatId,
      `❓ <b>راهنما</b>\n\n` +
        `1️⃣ لینک اسپوتیفای بفرست:\n` +
        `<code>https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh</code>\n\n` +
        `2️⃣ اسم آهنگ یا خواننده رو بنویس:\n` +
        `<code>Eminem Lose Yourself</code>\n\n` +
        `3️⃣ ربات آهنگ رو پیدا و ارسال می‌کنه! 🎶\n\n` +
        `📌 آهنگ‌های قبلاً دانلود شده از آرشیو کانال ارسال می‌شن (سریع‌تر!)`
    );
    return;
  }

  // دستور /stats
  if (text === "/stats") {
    try {
      const { getStats } = await import("./trackService");
      const stats = await getStats();
      let statsText =
        `📊 <b>آمار ربات</b>\n\n` +
        `🎵 کل آهنگ‌های آرشیو: <b>${stats.totalTracks}</b>\n` +
        `📥 کل درخواست‌ها: <b>${stats.totalRequests}</b>\n\n`;

      if (stats.topTracks.length > 0) {
        statsText += `🔥 <b>محبوب‌ترین‌ها:</b>\n`;
        stats.topTracks.forEach((t, i) => {
          statsText += `${i + 1}. ${t.trackName} - ${t.artistName} (${t.downloadCount} بار)\n`;
        });
      }

      await sendMessage(chatId, statsText);
    } catch {
      await sendMessage(chatId, "❌ خطا در دریافت آمار.");
    }
    return;
  }

  // بررسی آیا لینک اسپوتیفایه
  if (text.includes("spotify.com/track/") || text.includes("spotify:track:")) {
    const urlMatch = text.match(
      /(https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9?=&]+|spotify:track:[a-zA-Z0-9]+)/
    );
    if (urlMatch) {
      await processSpotifyRequest(chatId, userId, username, urlMatch[0]);
      return;
    }
  }

  // جستجوی متنی
  if (text.length >= 2 && !text.startsWith("/")) {
    await processSearchRequest(chatId, userId, username, text);
    return;
  }
}

// تایپ‌های تلگرام
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: { id: number };
    };
    data?: string;
  };
}
