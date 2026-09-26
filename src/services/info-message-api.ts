import { isInfoMessage, type InfoMessage } from '../domain/info-message';

// specs/020-info-banner: public read of the information message (contracts/info-message-api.md).
// Never throws: any failure simply means no banner (FR-008).
const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export async function getInfoMessage(): Promise<InfoMessage | undefined> {
  try {
    const response = await fetch(`${API_URL}/info-message`);
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    return isInfoMessage(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}
