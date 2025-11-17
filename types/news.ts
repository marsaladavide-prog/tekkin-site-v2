// /types/news.ts
export type NewsRow = {
  id: string;
  uuid?: string | null;
  title: string;
  slug: string | null;
  url: string;
  source: string | null;
  category: string | null;
  summary: string | null;
  created_at?: string | null;
  // se hai una colonna image_url aggiungila qui
  image_url?: string | null;
};
