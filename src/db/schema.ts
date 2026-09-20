import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  bigint,
} from "drizzle-orm/pg-core";

// جدول آهنگ‌های ذخیره‌شده در کانال تلگرام
export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  spotifyId: varchar("spotify_id", { length: 100 }).notNull().unique(),
  trackName: text("track_name").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name"),
  coverUrl: text("cover_url"),
  durationMs: integer("duration_ms"),
  // file_id در تلگرام برای ارسال مجدد بدون آپلود دوباره
  telegramFileId: text("telegram_file_id"),
  // message_id در کانال آرشیو
  channelMessageId: bigint("channel_message_id", { mode: "number" }),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// جدول لاگ درخواست‌های کاربران
export const userRequests = pgTable("user_requests", {
  id: serial("id").primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  spotifyUrl: text("spotify_url"),
  searchQuery: text("search_query"),
  trackId: integer("track_id").references(() => tracks.id),
  status: varchar("status", { length: 20 }).default("pending"), // pending, success, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// جدول تنظیمات ربات
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
