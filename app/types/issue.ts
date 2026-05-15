// One published newsletter edition, mirrored on the web as a recap page.
export type Issue = {
  id: string;
  number: number;
  slug: string;
  title: string;
  intro: string | null;
  published_at: string;
  created_at: string;
};
