export interface DocUploadRequest {
  content: string;
  file_path?: string;
  is_public?: boolean;
}

export interface DocUploadResponse {
  slug: string;
  url: string;
  is_new: boolean;
}

export interface DocResponse {
  slug: string;
  title: string;
  content: string;
  version: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  author: { name: string; avatar_url: string | null };
}

export interface DocListItem {
  slug: string;
  title: string;
  version: number;
  is_public: boolean;
  updated_at: string;
  read_pct: number | null;
}

export interface PositionPayload {
  scroll_pct: number;
  heading_id?: string;
}
