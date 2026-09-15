import type { Resource } from '../../domain/types';
import { formatKamas, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';
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
      {updatedAt && <small>Dernière mise à jour : {new Date(updatedAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}</small>}
      <input
        inputMode="numeric"
        aria-invalid={!valid}
        value={formatKamasInput(value)}
        onChange={(event) => onChange(normalizeKamasInput(event.target.value))}
        placeholder="Prix unitaire"
      />
      {value && valid && <b className="price-resource-formatted">{formatKamas(Number(value))}</b>}
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </label>
  );
}
