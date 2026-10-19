import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Kamas } from '../prices/PricesPage';
import { normalizeSearchText } from '../../services/dofusdb-api';
import {
  PET_FOODS,
  formatObjectiveShare,
  ordinal,
  petFoodTarget,
  type PetFoodPrice,
  type RankedPetFood,
} from '../../domain/pet-xp';
import { FoodImage, PriceAge } from './PetFoodPodium';

// specs/055-refonte-xp-familier (US3): look up one food — already in stock, or simply in mind — and
// see what it costs for the objective and where it stands among the cheapest.

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
const percentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

export function PetFoodTarget({ xp, prices, ranked, maxQuantity, xpMultiplier, selectedId, onSelect, query, onQueryChange }: {
  xp: number;
  prices: Record<string, PetFoodPrice | undefined>;
  ranked: readonly RankedPetFood[];
  maxQuantity: number | undefined;
  xpMultiplier: number;
  /** The food aimed at, kept by the page while it stays open (FR-008). */
  selectedId?: string;
  onSelect: (itemId: string) => void;
  /** The text typed, kept by the page with the food aimed at. */
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const normalizedQuery = normalizeSearchText(query);
  const suggestions = suggesting && normalizedQuery.length >= MIN_QUERY_LENGTH
    ? PET_FOODS.filter((food) => normalizeSearchText(food.name).includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .slice(0, MAX_SUGGESTIONS)
    : undefined;
  const selected = PET_FOODS.find((food) => food.itemId === selectedId);
  const card = selected ? petFoodTarget(selected, xp, prices, ranked, maxQuantity, xpMultiplier) : undefined;

  return (
    <section className="panel pet-target" aria-labelledby="pet-target-title">
      <div>
        <h2 id="pet-target-title">Viser une ressource précise</h2>
        <p className="pet-block-hint">Une ressource déjà en stock, ou en tête ? Voyez ce qu'elle coûte pour cet objectif.</p>
      </div>
      <div className="search-input-wrap">
        <Icon name="search" size={18} className="search-input-icon" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setSuggesting(true);
          }}
          placeholder="Nom d'une ressource…"
          aria-label="Rechercher une ressource à viser"
        />
      </div>
      {suggestions && (suggestions.length === 0 ? (
        <p className="pet-block-hint" role="status">Ne correspond à aucune ressource.</p>
      ) : (
        <div className="pet-target-suggestions" role="group" aria-label="Suggestions">
          {suggestions.map((food) => (
            <button
              key={food.itemId}
              type="button"
              className="pet-target-suggestion"
              onClick={() => {
                onSelect(food.itemId);
                onQueryChange(food.name);
                setSuggesting(false);
              }}
            >
              <FoodImage food={food} />
              <span>{food.name}</span>
            </button>
          ))}
        </div>
      ))}
      {card && (
        <div className="pet-target-card" role="region" aria-label={`Fiche de ${card.food.name}`}>
          <div className="pet-target-card-head">
            <FoodImage food={card.food} />
            <div>
              <h3>{card.food.name}</h3>
              <span>
                {numberFormat.format(card.xpPerUnit)} XP par unité
                {card.standing.kind === 'ranked' && ` · ${ordinal(card.standing.rank)} la moins chère`}
                {card.standing.kind === 'capped' && ` · Non classée (plus de ${numberFormat.format(card.standing.maxQuantity)} unités)`}
              </span>
              {card.price && <PriceAge date={card.price.date} />}
            </div>
          </div>
          <dl className="pet-figures pet-target-figures">
            <div><dt>Quantité</dt><dd>{numberFormat.format(card.quantity)}</dd></div>
            {card.price ? (
              <>
                <div><dt>Prix unitaire</dt><dd><Kamas value={card.price.unitPriceKamas} />{card.price.lotSize > 1 && <small> lot ×{card.price.lotSize}</small>}</dd></div>
                <div><dt>Coût total</dt><dd className="pet-figure-kamas"><Kamas value={card.price.totalKamas} /></dd></div>
                {card.standing.kind === 'ranked' && (
                  <div>
                    <dt>Écart avec la 1re</dt>
                    <dd className={card.standing.gapPercent > 0 ? 'pet-figure-gap' : undefined}>
                      {card.standing.gapPercent > 0 ? '+' : ''}{percentFormat.format(card.standing.gapPercent)} %
                    </dd>
                  </div>
                )}
              </>
            ) : (
              <div><dt>Prix unitaire</dt><dd>Prix inconnu</dd></div>
            )}
            <div><dt>1 unité =</dt><dd>{formatObjectiveShare(card.sharePercent)} %<small> de l'objectif</small></dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}
