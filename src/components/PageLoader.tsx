// Shown while a page is on its way: a Dofus (the logo's egg) breathes inside a soft halo in the theme's
// color, with the usual status text below it, which screen readers read.
export function PageLoader({ image, label = 'Chargement…' }: { image: string; label?: string }) {
  return (
    <div className="page-loader" role="status" aria-busy="true">
      <span className="page-loader-egg" aria-hidden="true">
        <img src={image} alt="" width="64" height="64" />
      </span>
      <span className="page-loader-label">{label}</span>
    </div>
  );
}
