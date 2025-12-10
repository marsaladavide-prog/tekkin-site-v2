export type Artist = {
  id: string;
  user_id?: string;
  artist_name: string;
  artist_photo_url?: string | null;
  artist_genre?: string | null;
  artist_link_source?: string | null;

  spotify_id?: string | null;
  spotify_url?: string | null;
  beatstats_url?: string | null;
  beatport_url?: string | null;
  instagram_url?: string | null;
  soundcloud_url?: string | null;
  traxsource_url?: string | null;
  songstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;

  socials?: {
    spotify?: string | null;
    beatport?: string | null;
    beatstats?: string | null;
    instagram?: string | null;
    soundcloud?: string | null;
  };
};

export type TekkinRankPhase = "building" | "rising" | "established" | "high_form";

export type ArtistRank = {
  tekkin_score: number;      // 0-100
  phase: TekkinRankPhase;    // building, rising, established, high_form
  level: string;             // label leggibile, es. "Building phase", "High Form"

  // Breakdown per la card
  growth_score: number;      // 0-20
  presence_score: number;    // 0-30
  catalog_score: number;     // 0-25
  activity_score: number;    // 0-20
};


export type ArtistMetrics = {
  // Spotify core
  spotify_followers: number | null;           // followers "oggi"
  spotify_followers_30d_ago: number | null;   // followers ~30 giorni fa
  spotify_followers_diff_30d: number | null;  // diff calcolata (oggi - 30 giorni fa)
  spotify_popularity: number | null;          // popularity 0-100

  // Catalogo Spotify
  total_releases: number;                     // tutte le release note
  releases_last_12m: number;                  // release negli ultimi 12 mesi

  // Attività Tekkin (progetti/versioni analizzate)
  analyzed_versions: number;                  // quante versioni con analyzer attivo

  // Metadato temporale
  collected_at: string | null;                // ultima data da metrics (ISO)
};

export type ArtistRankView = {
  artist: Artist;
  rank: ArtistRank;
  metrics: ArtistMetrics | null;
};

export const baseFallbackRank: ArtistRank = {
  tekkin_score: 50,
  phase: "building",
  level: "Building phase",
  growth_score: 10,
  presence_score: 15,
  catalog_score: 15,
  activity_score: 10,
};
