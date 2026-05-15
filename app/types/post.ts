export type Post = {
  id: string;
  title: string;
  // Null for own original content (e.g. memes) that has no external source.
  link: string | null;
  source: string | null;
  category: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
};
