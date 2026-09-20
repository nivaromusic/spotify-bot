/**
 * Telegram Bot Handler - بدون Spotify
 * کاربر اسم آهنگ می‌فرسته → YouTube سرچ → ۵ نتیجه → انتخاب → دانلود → ارسال
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { searchYouTubeMultiple, downloadFromYouTube } from "./youtube";
import {
  saveTrack,
  searchTracksInDb,
  findTrackBySpotifyId,
  logUserRequest,
} from "./trackService";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ARCHIVE_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// cache موقت عنوان ویدیوها (تو حافظه Worker)
const videoTitleCache = new Map<string, string>();

// ── توابع پایه تلگرام ────────────────────────────────────────

async function sendMessage(
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML",
  replyMarkup?: object
): Promise<number> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { result?: { message_id: number } };
  return data.result?.message_id || 0;
}

async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML",
  replyMarkup?: object
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

async function answerCallbackQuery(
  callbackQueryId: string,
  text: string
): Promise<void> {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ── ارسال audio از file_id ───────────────────────────────────

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

// ── آپلود فایل صوتی ──────────────────────────────────────────

async function uploadAudio(
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

  const data = (await response.json()) as {
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

// ── کپشن ──────────────────────────────────────────────────────

function formatCaption(
  trackName: string,
  artistName: string,
  durationMs: number,
  fromArchive: boolean
): string {
  const duration = durationMs
    ? `${Math.floor(durationMs / 60000)}:${String(
        Math.floor((durationMs % 60000) / 1000)
      ).padStart(2, "0")}`
    : "";
  const archiveBadge = fromArchive ? "♻️ از آرشیو" : "🆕 تازه دانلود";

  return (
    `🎵 <b>${trackName}</b>\n` +
    `👤 ${artistName}\n` +
    (duration ? `⏱ ${duration}\n` : "") +
    `\n${archiveBadge} | @${process.env.BOT_USERNAME || "MusicArchiveBot"}`
  );
}

// ── استخراج عنوان از عنوان YouTube ────────────────────────────

function cleanYoutubeTitle(title: string): {
  trackName: string;
  artistName: string;
} {
  const cleaned = title
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(
      /\b(official|video|audio|lyrics|lyric|hd|hq|4k|mv|music video|ft\.?|feat\.?|featuring)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" - ");
  if (parts.length >= 2) {
    return {
      artistName: parts[0].trim() || "Unknown",
      trackName: parts.slice(1).join(" - ").trim() || cleaned,
    };
  }

  return { trackName: cleaned || title, artistName: "Unknown" };
}

// ── جستجو در آرشیو (دیتابیس) ─────────────────────────────────

async function searchArchiveAndSend(
  chatId: number,
  query: string,
  userId: number,
  username: string | undefined
): Promise<boolean> {
  const results = await searchTracksInDb(query);

  if (results.length === 0) return false;

  const buttons = results.slice(0, 5).map((track) => [
    {
      text: `♻️ ${track.trackName} - ${track.artistName}`.slice(0, 60),
      callback_data: `local:${track.spotifyId}`,
    },
  ]);

  buttons.push([
    {
      text: "🔍 جستجو در YouTube (دانلود جدید)",
      callback_data: `ytsearch:${query}`.slice(0, 64),
    },
  ]);

  await sendMessage(
    chatId,
    `📚 <b>${results.length}</b> نتیجه در آرشیو پیدا شد:\n\nاگه آهنگ مورد نظرت نیست، دکمه‌ی «جستجو در YouTube» رو بزن.`,
    "HTML",
    { inline_keyboard: buttons }
  );

  await logUserRequest({
    telegramUserId: userId,
    telegramUsername: username,
    searchQuery: query,
    status: "pending",
  });

  return true;
}

// ── جستجو در YouTube (۵ نتیجه) ────────────────────────────────

async function searchYouTubeAndShowOptions(
  chatId: number,
  query: string,
  userId: number,
  username: string | undefined
): Promise<void> {
  const statusMsgId = await sendMessage(
    chatId,
    `🔍 در حال جستجو در YouTube برای: <b>${query}</b>...`
  );

  try {
    const results = await searchYouTubeMultiple(query, 5);

    if (!results || results.length === 0) {
      await editMessage(
        chatId,
        statusMsgId,
        `❌ هیچ نتیجه‌ای برای "<b>${query}</b>" در YouTube پیدا نشد.`
      );
      return;
    }

    const buttons = results.map((r, i) => {
      // ذخیره‌ی عنوان تو cache برای موقع دانلود
      videoTitleCache.set(r.videoId, r.title);

      // callback_data حداکثر ۶۴ بایت — پس فقط videoId رو می‌ذاریم
      return [
        {
          text: `🎵 ${i + 1}. ${r.title.slice(0, 50)}${r.title.length > 50 ? "..." : ""}`,
          callback_data: `ytdl:${r.videoId}`,
        },
      ];
    });
    buttons.push([{ text: "❌ انصراف", callback_data: "cancel" }]);

    await editMessage(
      chatId,
      statusMsgId,
      `🔍 <b>${results.length}</b> نتیجه در YouTube پیدا شد:\n\nیکی رو انتخاب کن:`,
      "HTML",
      { inline_keyboard: buttons }
    );

    await logUserRequest({
      telegramUserId: userId,
      telegramUsername: username,
      searchQuery: query,
      status: "pending",
    });
  } catch (err) {
    console.error("YouTube search error:", err);
    await editMessage(
      chatId,
      statusMsgId,
      "❌ خطا در جستجو. لطفاً بعداً امتحان کن."
    );
  }
}

// ── دانلود و ارسال آهنگ از YouTube ────────────────────────────

async function downloadAndSendFromYoutube(
  chatId: number,
  videoId: string,
  videoTitle: string,
  userId: number,
  username: string | undefined
): Promise<void> {
  const statusMsgId = await sendMessage(
    chatId,
    `⬇️ در حال دانلود: <b>${videoTitle.slice(0, 80)}</b>...`
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgbot-"));

  try {
    const { trackName, artistName } = cleanYoutubeTitle(videoTitle);
    const safeFilename = `${artistName} - ${trackName}`
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "")
      .substring(0, 80);

    await sendChatAction(chatId, "upload_audio");

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const audioFilePath = await downloadFromYouTube(
      videoUrl,
      tmpDir,
      safeFilename
    );

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      await editMessage(chatId, statusMsgId, "❌ فایل دانلود نشد.");
      return;
    }

    const caption = formatCaption(trackName, artistName, 0, false);

    let telegramFileId = "";
    let channelMsgId = 0;

    // ۱) آپلود به کانال آرشیو
    if (ARCHIVE_CHANNEL_ID) {
      await editMessage(
        chatId,
        statusMsgId,
        "📤 در حال آپلود در کانال آرشیو..."
      );
      const uploadResult = await uploadAudio(
        audioFilePath,
        ARCHIVE_CHANNEL_ID,
        trackName,
        artistName,
        caption
      );

      if (uploadResult) {
        telegramFileId = uploadResult.fileId;
        channelMsgId = uploadResult.messageId;
      }
    }

    // ۲) ارسال به کاربر
    if (telegramFileId) {
      await sendAudioFromFileId(chatId, telegramFileId, caption);
    } else {
      const uploadResult = await uploadAudio(
        audioFilePath,
        chatId,
        trackName,
        artistName,
        caption
      );
      if (!uploadResult) {
        await editMessage(chatId, statusMsgId, "❌ خطا در ارسال.");
        return;
      }
      telegramFileId = uploadResult.fileId;
    }

    // ۳) ذخیره در دیتابیس
    try {
      await saveTrack(
        {
          spotifyId: `yt:${videoId}`,
          trackName,
          artistName,
          albumName: "",
          coverUrl: "",
          durationMs: 0,
          spotifyUrl: videoUrl,
        },
        telegramFileId,
        channelMsgId
      );
    } catch (e) {
      console.error("Save track error:", e);
      // ذخیره نشد، ولی آهنگ ارسال شد — ادامه می‌دیم
    }

    await logUserRequest({
      telegramUserId: userId,
      telegramUsername: username,
      searchQuery: videoTitle,
      status: "success",
    });

    await deleteMessage(chatId, statusMsgId);
  } catch (err) {
    console.error("Download error:", err);
    await editMessage(
      chatId,
      statusMsgId,
      "❌ خطا در دانلود. دوباره امتحان کن."
    );
    await logUserRequest({
      telegramUserId: userId,
      telegramUsername: username,
      searchQuery: videoTitle,
      status: "failed",
      errorMessage: String(err),
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

// ── ارسال آهنگ از آرشیو ──────────────────────────────────────

async function sendArchiveTrack(
  chatId: number,
  spotifyId: string
): Promise<void> {
  const track = await findTrackBySpotifyId(spotifyId);
  if (track?.telegramFileId) {
    const caption = formatCaption(
      track.trackName,
      track.artistName,
      track.durationMs || 0,
      true
    );
    await sendAudioFromFileId(chatId, track.telegramFileId, caption);
  } else {
    await sendMessage(chatId, "❌ این آهنگ در آرشیو پیدا نشد.");
  }
}

// ── callback query ────────────────────────────────────────────

async function processCallbackQuery(
  callbackQueryId: string,
  chatId: number,
  userId: number,
  username: string | undefined,
  data: string
): Promise<void> {
  const colonIdx = data.indexOf(":");
  const type = colonIdx === -1 ? data : data.slice(0, colonIdx);
  const value = colonIdx === -1 ? "" : data.slice(colonIdx + 1);

  if (type === "cancel") {
    await answerCallbackQuery(callbackQueryId, "لغو شد.");
    await sendMessage(chatId, "❌ لغو شد.");
    return;
  }

  await answerCallbackQuery(callbackQueryId, "⏳ در حال پردازش...");

  if (type === "local") {
    await sendArchiveTrack(chatId, value);
  } else if (type === "ytsearch") {
    await searchYouTubeAndShowOptions(chatId, value, userId, username);
  } else if (type === "ytdl") {
    const videoId = value;
    const videoTitle = videoTitleCache.get(videoId) || "Unknown";
    await downloadAndSendFromYoutube(
      chatId,
      videoId,
      videoTitle,
      userId,
      username
    );
  }
}

// ── handle Telegram Update ────────────────────────────────────

export async function handleTelegramUpdate(
  update: TelegramUpdate
): Promise<void> {
  // callback query
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
  const text = (message.text || "").trim();

  // /start
  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      `🎵 <b>به ربات موزیک Nivaro خوش اومدی!</b>\n\n` +
        `کافیه اسم آهنگ یا خواننده رو بفرستی، من از YouTube برات پیدا و دانلود می‌کنم 🎧\n\n` +
        `<b>مثال:</b>\n` +
        `<code>Bohemian Rhapsody</code>\n` +
        `<code>Eminem Lose Yourself</code>\n\n` +
        `📦 آرشیو کامل موزیک در کانال ما!`
    );
    return;
  }

  // /help
  if (text === "/help") {
    await sendMessage(
      chatId,
      `❓ <b>راهنما</b>\n\n` +
        `1️⃣ اسم آهنگ یا خواننده رو بنویس:\n` +
        `<code>Eminem Lose Yourself</code>\n\n` +
        `2️⃣ بات ۵ نتیجه از YouTube می‌آره، یکیش رو انتخاب کن\n\n` +
        `3️⃣ بات دانلود می‌کنه و برات می‌فرسته! 🎶\n\n` +
        `📌 آهنگ‌های قبلاً دانلود شده از آرشیو ارسال می‌شن (سریع‌تر!)`
    );
    return;
  }

  // /stats
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

  // اگه لینک Spotify بود، فقط راهنمایی کن
  if (text.includes("spotify.com/") || text.includes("spotify:")) {
    await sendMessage(
      chatId,
      `⚠️ لینک Spotify پشتیبانی نمی‌شه.\n\nلطفاً <b>اسم آهنگ و خواننده</b> رو بفرست:\n<code>Bohemian Rhapsody Queen</code>`
    );
    return;
  }

  // جستجوی متنی
  if (text.length >= 2 && !text.startsWith("/")) {
    // اول تو آرشیو بگرد
    const foundInArchive = await searchArchiveAndSend(
      chatId,
      text,
      userId,
      username
    );
    if (foundInArchive) return;

    // اگه تو آرشیو نبود، YouTube رو سرچ کن
    await searchYouTubeAndShowOptions(chatId, text, userId, username);
    return;
  }
}

// ── تایپ‌های تلگرام ──────────────────────────────────────────

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
