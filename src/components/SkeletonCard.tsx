export function SkeletonCard({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton-block skeleton-thumb" />
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
