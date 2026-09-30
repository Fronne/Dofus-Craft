import { useState } from 'react';
import { fmItemDisplayName, type FmChannel, type FmOwnedItem } from '../../domain/forgemagie';
import { attachFmChannel } from '../../services/fm-api';

// specs/029-channel-ownership (FR-011, FR-013): a player's personal FM channels; on one's own profile, attach
// a whole channel to an item in FM — all its sessions, past and future, then count for that item.

function ChannelItemPicker({ channel, items, onChanged }: { channel: FmChannel; items: FmOwnedItem[]; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const change = async (fmItemId: string) => {
    setSaving(true);
    const result = await attachFmChannel(channel.channelId, fmItemId || null);
    setSaving(false);
    setFailed(result.status !== 'ok');
    if (result.status === 'ok') onChanged();
  };
  return (
    <span className="fm-attach">
      <select
        className="hdv-type-filter"
        value={channel.fmItem?.id ?? ''}
        disabled={saving}
        onChange={(event) => void change(event.target.value)}
        aria-label={`Objet du salon #${channel.channelName}`}
      >
        <option value="">Aucun objet</option>
        {items.map((item) => <option key={item.id} value={item.id}>{fmItemDisplayName(item)}</option>)}
      </select>
      {failed && <span className="fm-error" role="alert">Échec, réessaie.</span>}
    </span>
  );
}

export function FmChannelsSection({ channels, items, isMine, onChanged }: {
  channels: FmChannel[];
  items: FmOwnedItem[];
  isMine: boolean;
  onChanged: () => void;
}) {
  return (
    <section className="fm-items-section" aria-label="Salons FM">
      <h3 className="fm-subtitle">Salons FM</h3>
      {channels.length === 0 ? (
        <p className="fm-note">
          {isMine
            ? 'Crée ton salon avec le bouton « Nouvelle séance de FM » dans Discord, ou « Démarrer une séance » dans l’onglet Sessions.'
            : 'Aucun salon FM.'}
        </p>
      ) : (
        <ul className="fm-spend-list">
          {channels.map((channel) => (
            <li key={channel.channelId}>
              <span>
                <b>#{channel.channelName}</b>
                {channel.status === 'archived' && <span className="fm-note"> · archivé</span>}
              </span>
              {isMine
                ? <ChannelItemPicker channel={channel} items={items} onChanged={onChanged} />
                : <span className="fm-note">{channel.fmItem ? channel.fmItem.name : 'Aucun objet'}</span>}
            </li>
          ))}
        </ul>
      )}
      {isMine && channels.length > 0 && (
        <p className="fm-note">Un objet choisi pour un salon compte toutes ses sessions, passées et futures, sauf celles rattachées à la main à un autre objet.</p>
      )}
    </section>
  );
}
