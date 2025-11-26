import { SupabaseClient } from "@supabase/supabase-js";

// Tipi minimi per lavorare lato server con Supabase in fase di registrazione
export type ArtistSignupMetadata = {
  artist_name?: string | null;
  artist_genre?: string | null;
  artist_photo_url?: string | null;
  artist_image_url?: string | null;
  artist_link_source?: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  instagram_url?: string | null;
  beatport_url?: string | null;
  traxsource_url?: string | null;
  soundcloud_url?: string | null;
  songstats_url?: string | null;
  beatstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
};

export type UsersProfileInsert = {
  id: string;
  user_id: string;
  artist_name?: string | null;
  artist_genre?: string | null;
  artist_photo_url?: string | null;
  artist_link_source?: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  instagram_url?: string | null;
  beatport_url?: string | null;
  traxsource_url?: string | null;
  soundcloud_url?: string | null;
  songstats_url?: string | null;
  beatstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
  basic_completed?: boolean | null;
};

export type ArtistInsert = {
  id: string;
  user_id: string;
  artist_name?: string | null;
  artist_genre?: string | null;
  artist_photo_url?: string | null;
  artist_link_source?: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  instagram_url?: string | null;
  beatport_url?: string | null;
  beatstats_url?: string | null;
  traxsource_url?: string | null;
  soundcloud_url?: string | null;
  songstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
};

export type Database = {
  public: {
    Tables: {
      users_profile: {
        Row: UsersProfileInsert;
        Insert: UsersProfileInsert;
        Update: Partial<UsersProfileInsert>;
      };
      artists: {
        Row: ArtistInsert & { created_at?: string | null };
        Insert: ArtistInsert;
        Update: Partial<ArtistInsert>;
      };
    };
  };
};

export type AdminSupabaseClient = SupabaseClient<Database>;
