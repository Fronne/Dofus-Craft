// The picture of an item in FM, or an empty square of the same size when it has none.
export function FmItemIcon({ imageUrl }: { imageUrl: string | null }) {
  return imageUrl
    ? <img className="fm-item-icon" src={imageUrl} alt="" width={32} height={32} loading="lazy" />
    : <span className="fm-item-icon" aria-hidden="true" />;
}
