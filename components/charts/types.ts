export type ChartSnapshotEntry = {
  profile_key: string;
  project_id: string;
  version_id: string;
  track_title: string | null;
  artist_name: string | null;
  artist_id?: string | null;
  cover_url: string | null;
  audio_url: string | null;
  mix_type: string | null;
  rank_position: number;
  score_public: number | null;
};

export type TopArtistSummary = {
  id: string;
  artist_name: string | null;
  ig_profile_picture?: string | null;
  artist_photo_url?: string | null;
  spotify_followers?: number | null;
};

export type ChartTopArtist = {
  id: string | null;
  name: string;
  avatarUrl?: string | null;
  score?: number | null;
};

export type ChartPlaylistHighlight = {
  rank: number;
  title: string;
  artist: string;
  score?: number | null;
};

export type ChartPlaylistCard = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  highlights?: ChartPlaylistHighlight[];
};
