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
  /** "markdown" | "html" | "txt" | "pdf" — drives which renderer the web app uses. */
  format: import("./format.js").DocFormat;
  /** Text payload (md/html/txt). Empty for pdf — fetch bytes from /api/docs/:slug/raw. */
  content: string;
  version: number;
  is_public: boolean;
  /** True when the requesting user owns this doc — drives owner-only controls (toggle/delete). */
  is_owner: boolean;
  created_at: string;
  updated_at: string;
  author: { name: string; avatar_url: string | null };
}

export interface DocListItem {
  slug: string;
  title: string;
  format: import("./format.js").DocFormat;
  version: number;
  is_public: boolean;
  updated_at: string;
  read_pct: number | null;
}

export interface PositionPayload {
  scroll_pct: number;
  heading_id?: string;
}
