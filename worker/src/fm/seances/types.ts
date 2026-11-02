import { json } from '../http';
import type { ItemRow } from '../reads';

export type ChannelRow = { channel_id: string; channel_name: string; status: 'active' | 'archived' | 'deleted'; fm_item_id: string | null; created_at: string };
export type SessionRow = {
  id: string; channel_id: string; channel_name: string; status: 'open' | 'closed'; opened_at: string; closed_at: string | null;
  fm_item_id: string | null; origin: 'discord' | 'site'; sync_status: 'pending' | 'opened' | 'failed' | 'cancelled' | null; sync_error: string | null;
};
export type TotalRow = { session_id: string; total_kamas: number; capture_count: number; last_capture_at: string };
export type ItemView = { id: string; name: string; itemName: string; label: string | null; imageUrl: string | null };
export type ItemViewRow = { id: string; label: string | null; item_name: string; item_image_url: string | null };

export type FoundSeance = { channel: ChannelRow | undefined; sessions: SessionRow[] };

export type CorrectedItemRow = ItemRow & { corrected: number };
export type LineRow = {
  id: string; capture_id: string; item_name: string; quantity: number; total_kamas: number; unit_price_kamas: number;
  original_quantity: number | null; original_total_kamas: number | null; corrected_at: string | null; price_status: string;
  original_item_name: string | null; counted: number;
};
export type CommandRow = { type: string; session_id: string | null; status: string; error: string | null; created_at: string };

export const notFound = () => json({ error: 'Not found' }, 404);
