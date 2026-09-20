import { getStats } from "@/lib/trackService";
import { isCloudflareConfigured } from "@/lib/cloudflare";
import SetupPanel from "@/components/SetupPanel";
import StatsCards from "@/components/StatsCards";
import TracksList from "@/components/TracksList";
import BotFlowDiagram from "@/components/BotFlowDiagram";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stats = { totalTracks: 0, totalRequests: 0, topTracks: [] as Array<{ trackName: string; artistName: string; downloadCount: number | null }> };
  try {
    stats = await getStats();
  } catch {
    // دیتابیس هنوز آماده نشده
  }

  const isConfigured = {
    bot: !!process.env.TELEGRAM_BOT_TOKEN,
    spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    channel: !!process.env.TELEGRAM_CHANNEL_ID,
    cloudflare: isCloudflareConfigured(),
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-gray-950/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl shadow-lg shadow-green-500/20">
              🎵
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Music Archive Bot</h1>
              <p className="text-purple-400 text-xs">ربات تلگرام دانلود موزیک</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isConfigured.bot
                ? "bg-green-500/15 text-green-400 border border-green-500/20"
                : "bg-red-500/15 text-red-400 border border-red-500/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConfigured.bot ? "bg-green-400 animate-pulse" : "bg-red-400"}`}></span>
              {isConfigured.bot ? "ربات فعال" : "ربات غیرفعال"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/40 to-green-900/20 border border-purple-800/30 p-8 md:p-12">
          <div className="absolute inset-0 opacity-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/music-wave.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
              <span className="text-green-400 text-sm font-medium">🤖 Telegram + Spotify + Cloudflare</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
              آرشیو هوشمند موزیک<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">با کش Cloudflare</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl">
              کاربر لینک اسپوتیفای می‌فرسته → ربات بررسی می‌کنه → اگر در آرشیو نیست دانلود می‌کنه → در کانال ذخیره می‌کنه → به کاربر ارسال می‌کنه
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards
          totalTracks={stats.totalTracks}
          totalRequests={stats.totalRequests}
          isConfigured={isConfigured}
        />

        {/* Flow Diagram */}
        <BotFlowDiagram />

        {/* Setup Panel */}
        {(!isConfigured.bot || !isConfigured.spotify) && (
          <SetupPanel isConfigured={isConfigured} />
        )}

        {/* Top Tracks */}
        {stats.topTracks.length > 0 && (
          <div className="rounded-2xl bg-gray-900/60 border border-gray-800/50 p-6">
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              🔥 محبوب‌ترین آهنگ‌ها
            </h3>
            <div className="space-y-2">
              {stats.topTracks.map((track, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-600 w-8">{i + 1}</span>
                    <div>
                      <p className="text-white font-medium text-sm">{track.trackName}</p>
                      <p className="text-gray-500 text-xs">{track.artistName}</p>
                    </div>
                  </div>
                  <span className="text-green-400 text-sm font-medium">{track.downloadCount} بار</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracks List */}
        <TracksList />
      </div>
    </main>
  );
}
