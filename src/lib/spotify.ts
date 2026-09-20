/**
 * Spotify Web API Integration
 * دریافت اطلاعات آهنگ از Spotify
 */

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
  external_urls: { spotify: string };
}

export interface TrackInfo {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  coverUrl: string;
  durationMs: number;
  spotifyUrl: string;
}

// گرفتن Access Token از Spotify
async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// استخراج Track ID از لینک Spotify
export function extractSpotifyTrackId(url: string): string | null {
  const patterns = [
    /spotify\.com\/track\/([a-zA-Z0-9]+)/,
    /spotify:track:([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// گرفتن اطلاعات آهنگ از Spotify API
export async function getTrackInfo(trackId: string): Promise<TrackInfo> {
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get track info: ${response.statusText}`);
  }

  const track = await response.json() as SpotifyTrack;

  const artistName = track.artists.map((a) => a.name).join(", ");
  const coverUrl =
    track.album.images.sort((a, b) => b.width - a.width)[0]?.url || "";

  return {
    spotifyId: track.id,
    trackName: track.name,
    artistName,
    albumName: track.album.name,
    coverUrl,
    durationMs: track.duration_ms,
    spotifyUrl: track.external_urls.spotify,
  };
}

// جستجوی آهنگ در Spotify
export async function searchSpotify(query: string): Promise<TrackInfo[]> {
  const token = await getSpotifyToken();

  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=5`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.statusText}`);
  }

  const data = await response.json() as { tracks: { items: SpotifyTrack[] } };
  const tracks = data.tracks.items;

  return tracks.map((track) => {
    const artistName = track.artists.map((a) => a.name).join(", ");
    const coverUrl =
      track.album.images.sort((a, b) => b.width - a.width)[0]?.url || "";

    return {
      spotifyId: track.id,
      trackName: track.name,
      artistName,
      albumName: track.album.name,
      coverUrl,
      durationMs: track.duration_ms,
      spotifyUrl: track.external_urls.spotify,
    };
  });
}

// فرمت کردن مدت زمان
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
