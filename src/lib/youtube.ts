/**
 * YouTube Search + Download
 * جستجو و دانلود آهنگ از یوتوب با yt-dlp
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  url: string;
}

// ── جستجوی تک‌نتیجه (برای سازگاری با کد قدیم) ────────────────

export async function searchYouTube(
  query: string
): Promise<YoutubeSearchResult | null> {
  const results = await searchYouTubeMultiple(query, 1);
  return results[0] || null;
}

// ── جستجوی چند نتیجه ─────────────────────────────────────────

export async function searchYouTubeMultiple(
  query: string,
  maxResults: number = 5
): Promise<YoutubeSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // اگه YOUTUBE_API_KEY داری، از Data API استفاده کن
  if (apiKey) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=${maxResults}&key=${apiKey}`
      );

      if (response.ok) {
        const data = (await response.json()) as {
          items?: Array<{
            id: { videoId: string };
            snippet: { title: string };
          }>;
        };

        if (data.items && data.items.length > 0) {
          return data.items
            .filter((item) => item.id?.videoId)
            .map((item) => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            }));
        }
      }
    } catch (err) {
      console.error("YouTube Data API error:", err);
    }
  }

  // fallback: yt-dlp
  return searchYouTubeMultipleWithYtDlp(query, maxResults);
}

// ── جستجو با yt-dlp ─────────────────────────────────────────

async function searchYouTubeMultipleWithYtDlp(
  query: string,
  maxResults: number
): Promise<YoutubeSearchResult[]> {
  try {
    const ytDlpPath = await getYtDlpPath();
    const { stdout } = await execAsync(
      `${ytDlpPath} "ytsearch${maxResults}:${query}" --get-id --get-title --no-playlist 2>/dev/null`,
      { timeout: 45000 }
    );

    const lines = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const results: YoutubeSearchResult[] = [];

    // yt-dlp با --get-id --get-title: خط اول title، خط دوم id
    for (let i = 0; i < lines.length - 1; i += 2) {
      const title = lines[i];
      const videoId = lines[i + 1];
      if (title && videoId && videoId.length === 11) {
        results.push({
          videoId,
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("yt-dlp search failed:", err);
    return [];
  }
}

// ── پیدا کردن مسیر yt-dlp ───────────────────────────────────

async function getYtDlpPath(): Promise<string> {
  const paths = [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "yt-dlp",
    path.join(os.homedir(), ".local/bin/yt-dlp"),
  ];

  for (const p of paths) {
    try {
      await execAsync(`${p} --version 2>/dev/null`);
      return p;
    } catch {
      continue;
    }
  }

  throw new Error("yt-dlp not found. Please install it.");
}

// ── دانلود آهنگ از یوتوب ────────────────────────────────────

export async function downloadFromYouTube(
  videoUrl: string,
  outputDir: string,
  filename: string
): Promise<string> {
  const ytDlpPath = await getYtDlpPath();
  const outputPath = path.join(outputDir, `${filename}.%(ext)s`);

  const command = [
    ytDlpPath,
    `"${videoUrl}"`,
    "-x",
    "--audio-format mp3",
    "--audio-quality 0",
    `--output "${outputPath}"`,
    "--no-playlist",
    "--quiet",
    "--no-warnings",
  ].join(" ");

  await execAsync(command, { timeout: 180000 });

  const mp3Path = path.join(outputDir, `${filename}.mp3`);

  if (fs.existsSync(mp3Path)) {
    return mp3Path;
  }

  // اگه پسوند فرق داشت
  const files = fs.readdirSync(outputDir);
  const audioFile = files.find(
    (f) =>
      f.startsWith(filename) &&
      (f.endsWith(".mp3") ||
        f.endsWith(".m4a") ||
        f.endsWith(".opus") ||
        f.endsWith(".webm"))
  );

  if (audioFile) {
    return path.join(outputDir, audioFile);
  }

  throw new Error("Downloaded file not found");
}

// ── دانلود مستقیم با spotdl (اختیاری) ───────────────────────

export async function downloadWithSpotdl(
  spotifyUrl: string,
  outputDir: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `spotdl "${spotifyUrl}" --output "${outputDir}" --format mp3 2>&1`,
      { timeout: 180000 }
    );

    const match = stdout.match(/Downloaded "(.+?)"/);
    if (match) {
      const files = fs.readdirSync(outputDir);
      const mp3File = files.find((f) => f.endsWith(".mp3"));
      if (mp3File) return path.join(outputDir, mp3File);
    }

    const files = fs.readdirSync(outputDir);
    const mp3File = files.find((f) => f.endsWith(".mp3"));
    return mp3File ? path.join(outputDir, mp3File) : null;
  } catch {
    return null;
  }
}
