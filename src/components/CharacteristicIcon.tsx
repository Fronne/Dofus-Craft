// Bump whenever the files under public/characteristic-icons/ change: they're static assets
// served at a stable URL, so the browser's own image cache won't notice an edited file unless
// the URL itself changes (a plain reload isn't enough to see the new pixels).
const ICON_ASSET_VERSION = 3;

export function CharacteristicIcon({ asset, size = 26 }: { asset: string; size?: number }) {
  return (
    <img
      className="characteristic-icon"
      src={`/characteristic-icons/${asset}.png?v=${ICON_ASSET_VERSION}`}
      alt=""
      width={size}
      height={size}
    />
  );
}
