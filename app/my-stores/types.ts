export interface Store {
  id: string;
  prompt_text: string;
  store_url: string;
  hero_image_url: string | null;
  is_starred: boolean;
  created_at: string; // ISO date string
  user_id?: string;
  user_email?: string;
  hero_title?: string;
  hero_description?: string;
}
