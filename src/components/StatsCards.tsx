"use client";

interface Props {
  totalTracks: number;
  totalRequests: number;
  isConfigured: {
    bot: boolean;
    spotify: boolean;
    channel: boolean;
    cloudflare: boolean;
  };
}

export default function StatsCards({ totalTracks, totalRequests, isConfigured }: Props) {
  const cards = [
    {
      icon: "🎵",
      label: "آهنگ‌های آرشیو",
      value: totalTracks.toLocaleString("fa-IR"),
      color: "from-purple-600 to-violet-600",
      bg: "bg-purple-900/20",
      border: "border-purple-800/30",
    },
    {
      icon: "📥",
      label: "کل درخواست‌ها",
      value: totalRequests.toLocaleString("fa-IR"),
      color: "from-blue-600 to-cyan-600",
      bg: "bg-blue-900/20",
      border: "border-blue-800/30",
    },
    {
      icon: "🤖",
      label: "وضعیت ربات",
      value: isConfigured.bot ? "فعال" : "غیرفعال",
      color: isConfigured.bot ? "from-green-600 to-emerald-600" : "from-red-600 to-rose-600",
      bg: isConfigured.bot ? "bg-green-900/20" : "bg-red-900/20",
      border: isConfigured.bot ? "border-green-800/30" : "border-red-800/30",
    },
    {
      icon: "☁️",
      label: "Cloudflare KV",
      value: isConfigured.cloudflare ? "متصل" : "غیرفعال",
      color: isConfigured.cloudflare ? "from-orange-500 to-amber-500" : "from-gray-600 to-gray-500",
      bg: isConfigured.cloudflare ? "bg-orange-900/20" : "bg-gray-800/20",
      border: isConfigured.cloudflare ? "border-orange-800/30" : "border-gray-700/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl ${card.bg} border ${card.border} p-5`}
        >
          <div className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} items-center justify-center text-xl mb-3 shadow-lg`}>
            {card.icon}
          </div>
          <p className="text-gray-500 text-xs mb-1">{card.label}</p>
          <p className="text-white font-bold text-xl">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
