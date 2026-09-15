import type { Resource } from '../../domain/types';

export function ResourceDisplay({
  resource,
  quantity,
}: {
  resource: Resource;
  quantity?: number;
}) {
  return (
    <span className="resource-display">
      {resource.imageUrl ? (
        <img src={resource.imageUrl} alt="" loading="lazy" width="32" height="32" />
      ) : (
        <span className="resource-image-fallback" role="img" aria-label={`Visuel indisponible pour ${resource.name}`}>
          {resource.name.slice(0, 1)}
        </span>
      )}
      <span>{resource.name}{quantity !== undefined && ` × ${quantity}`}</span>
    </span>
  );
}
