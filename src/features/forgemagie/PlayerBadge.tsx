import type { FmPlayer } from '../../domain/forgemagie';

// A player's avatar and Discord name; a private player is shown as « Joueur privé » (FR-015).
export function PlayerBadge({ player }: { player: FmPlayer }) {
  const name = player.displayName ?? 'Joueur privé';
  return (
    <span className={`fm-player${player.displayName === null ? ' fm-player--private' : ''}`}>
      {player.avatarUrl ? (
        <img className="fm-avatar" src={player.avatarUrl} alt="" width={24} height={24} loading="lazy" />
      ) : (
        <span className="fm-avatar fm-avatar--empty" aria-hidden="true">{player.displayName ? player.displayName.charAt(0).toUpperCase() : '?'}</span>
      )}
      <span className="fm-player-name">{name}</span>
    </span>
  );
}
