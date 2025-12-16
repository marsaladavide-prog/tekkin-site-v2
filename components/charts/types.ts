export type ChartSnapshotEntry = {
  rank_position: number;
  project_id: string;
  version_id: string;
  track_title: string | null;
  artist_name: string | null;
  cover_url: string | null;
  audio_url: string | null;
  mix_type: string | null;
  score_public: number | null;
};

export type TopArtistSummary = {
  id: string;
  artist_name: string | null;
  ig_profile_picture?: string | null;
  artist_photo_url?: string | null;
  spotify_followers?: number | null;
};
