import type { Resource } from '../../domain/types';
import { formatKamas, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';

export function ResourcePriceInput({
  resource,
  quantity,
  value,
  updatedAt,
  onChange,
}: {
  resource: Resource;
  quantity: number;
  value: string;
  updatedAt?: string;
  onChange: (value: string) => void;
}) {
  const valid = isValidKamas(value);
  return (
    <label className="price-line">
      <span className="price-resource">
        <ResourceDisplay resource={resource} />
      </span>
      <span className="price-resource-quantity">× {quantity}</span>
      {updatedAt && <small>Dernière mise à jour : {formatRelativeTime(updatedAt)}</small>}
      <span className="kamas-input-wrap">
        <input
          inputMode="numeric"
          aria-invalid={!valid}
          value={formatKamasInput(value)}
          onChange={(event) => onChange(normalizeKamasInput(event.target.value))}
          placeholder="Prix unitaire"
        />
        {value && <span className="kamas-input-suffix">kamas</span>}
      </span>
      {value && valid && <b className="price-resource-formatted">{formatKamas(Number(value) * quantity)}</b>}
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </label>
  );
}
