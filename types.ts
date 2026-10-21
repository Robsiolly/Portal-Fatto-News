export type Article = { id: string; title: string; summary: string; url: string; source: string; categories: string[]; publishedAt: string | null; image: string | null; imageCredit: string | null; urgent: boolean };
export type Feed = { items: Article[]; updatedAt: string };
