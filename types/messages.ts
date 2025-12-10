export type ArtistMessageThread = {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_a_id: string;
  user_b_id: string;
};

export type ArtistMessage = {
  id: string;
  created_at: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
};

export type PeerProfile = {
  id: string;
  artist_name: string | null;
  avatar_url: string | null;
};
