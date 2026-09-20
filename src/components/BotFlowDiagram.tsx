"use client";

const steps = [
  {
    icon: "👤",
    title: "کاربر",
    desc: "لینک اسپوتیفای یا اسم آهنگ می‌فرسته",
    color: "bg-blue-600",
  },
  {
    icon: "🔍",
    title: "بررسی آرشیو",
    desc: "Cloudflare KV → PostgreSQL",
    color: "bg-orange-500",
  },
  {
    icon: "⬇️",
    title: "دانلود",
    desc: "YouTube Search → yt-dlp → MP3",
    color: "bg-red-600",
  },
  {
    icon: "📤",
    title: "آپلود کانال",
    desc: "ذخیره در کانال آرشیو تلگرام",
    color: "bg-purple-600",
  },
  {
    icon: "💾",
    title: "ذخیره file_id",
    desc: "PostgreSQL + Cloudflare KV",
    color: "bg-amber-600",
  },
  {
    icon: "🎵",
    title: "ارسال به کاربر",
    desc: "بدون آپلود مجدد!",
    color: "bg-green-600",
  },
];

export default function BotFlowDiagram() {
  return (
    <div className="rounded-2xl bg-gray-900/60 border border-gray-800/50 p-6">
      <h3 className="text-white font-semibold text-lg mb-6 flex items-center gap-2">
        ⚡ نحوه کارکرد ربات
      </h3>
      <div className="relative">
        {/* Flow Steps */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              {/* Connector Line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-1/2 w-full h-0.5 bg-gradient-to-r from-gray-700 to-gray-700 z-0" style={{ left: "50%" }} />
              )}
              {/* Step Circle */}
              <div className={`relative z-10 w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center text-2xl shadow-lg mb-3`}>
                {step.icon}
              </div>
              {/* Step Number */}
              <span className="absolute top-0 right-0 w-5 h-5 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 text-xs font-bold z-20">
                {i + 1}
              </span>
              <p className="text-white text-xs font-semibold mb-1">{step.title}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Cache Highlight */}
        <div className="mt-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
          <span className="text-2xl">♻️</span>
          <div>
            <p className="text-orange-400 font-medium text-sm">بهینه‌سازی با Cloudflare KV</p>
            <p className="text-gray-500 text-xs mt-1">
              اگر آهنگ قبلاً دانلود شده باشه، مستقیم از <code className="text-orange-300 bg-orange-900/30 px-1 rounded">file_id</code> ذخیره‌شده در Cloudflare KV ارسال می‌شه — بدون دانلود مجدد!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
