/**
 * YouTube Search Integration
 * جستجو و دانلود آهنگ از یوتیوب
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

// جستجوی آهنگ در یوتیوب با استفاده از YouTube Data API
export async function searchYouTube(
  query: string
): Promise<YoutubeSearchResult | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    // fallback: استفاده از yt-dlp برای جستجو
    return searchYouTubeWithYtDlp(query);
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&maxResults=1&key=${apiKey}`
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: { title: string };
      }>;
    };

    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  } catch {
    return searchYouTubeWithYtDlp(query);
  }
}

// جستجو با yt-dlp (بدون API key)
async function searchYouTubeWithYtDlp(
  query: string
): Promise<YoutubeSearchResult | null> {
  try {
    const ytDlpPath = await getYtDlpPath();
    const { stdout } = await execAsync(
      `${ytDlpPath} "ytsearch1:${query}" --get-id --get-title --no-playlist 2>/dev/null`,
      { timeout: 30000 }
    );

    const lines = stdout.trim().split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      const title = lines[0];
      const videoId = lines[1];
      return {
        videoId,
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// پیدا کردن مسیر yt-dlp
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

  throw new Error("yt-dlp not found. Please install it: pip install yt-dlp");
}

// دانلود آهنگ از یوتیوب
export async function downloadFromYouTube(
  videoUrl: string,
  outputDir: string,
  filename: string
): Promise<string> {
  const ytDlpPath = await getYtDlpPath();
  const outputPath = path.join(outputDir, `${filename}.%(ext)s`);

  // دانلود بهترین کیفیت صدا و تبدیل به MP3
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

  await execAsync(command, { timeout: 120000 });

  const mp3Path = path.join(outputDir, `${filename}.mp3`);

  if (!fs.existsSync(mp3Path)) {
    // ممکنه با پسوند دیگه ذخیره شده باشه
    const files = fs.readdirSync(outputDir);
    const audioFile = files.find(
      (f) =>
        f.startsWith(filename) &&
        (f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".opus"))
    );
    if (audioFile) {
      return path.join(outputDir, audioFile);
    }
    throw new Error("Downloaded file not found");
  }

  return mp3Path;
}

// دانلود مستقیم با spotdl (اگر نصب باشه)
export async function downloadWithSpotdl(
  spotifyUrl: string,
  outputDir: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `spotdl "${spotifyUrl}" --output "${outputDir}" --format mp3 2>&1`,
      { timeout: 180000 }
    );

    // پیدا کردن فایل دانلود شده
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
