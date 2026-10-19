import { Kamas } from '../prices/PricesPage';
import { classifyPriceAge } from '../../domain/price-age';
import { formatRelativeTime } from '../../domain/time';
import { ordinal, type PetFood, type PetFoodPodiumEntry } from '../../domain/pet-xp';

// specs/055-refonte-xp-familier (US2): the 3 cheapest foods for the objective, in large cards.

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** A food's image in a framed tile, or its initial when it has none; its name is written next to it. */
export function FoodImage({ food }: { food: PetFood }) {
  return (
    <span className="pet-food-image" aria-hidden="true">
      {food.imageUrl ? <img src={food.imageUrl} alt="" loading="lazy" width="40" height="40" /> : food.name.slice(0, 1)}
    </span>
  );
}

/** The age of a price, flagged amber or coral like elsewhere once it gets old. */
export function PriceAge({ date }: { date?: string }) {
  const age = classifyPriceAge(date);
  const ageClass = age === 'stale' ? ' market-date--stale' : age === 'expired' ? ' market-date--expired' : '';
  return <small className={`market-date${ageClass}`}>{date ? `Prix relevé ${formatRelativeTime(date)}` : 'Date du prix inconnue'}</small>;
}

export function PetFoodPodium({ entries, caption }: { entries: PetFoodPodiumEntry[]; caption: string }) {
  return (
    <section className="pet-podium" aria-labelledby="pet-podium-title">
      <div className="pet-block-head">
        <h2 id="pet-podium-title">Les moins chères pour cet objectif</h2>
        <span>{caption}</span>
      </div>
      <ol className="pet-podium-list">
        {entries.map((entry) => (
          <li key={entry.food.itemId}>
            <article className={`pet-podium-card${entry.rank === 1 ? ' pet-podium-card--first' : ''}`}>
              <div className="pet-podium-card-head">
                <FoodImage food={entry.food} />
                <div>
                  <span className="pet-podium-rank">
                    {entry.rank === 1 ? '1re · la moins chère' : <>{ordinal(entry.rank)} · <Kamas value={entry.gapKamas} signed /></>}
                  </span>
                  <h3>{entry.food.name}</h3>
                </div>
              </div>
              <b className="pet-podium-total"><Kamas value={entry.totalKamas} /></b>
              <dl className="pet-figures">
                <div><dt>Quantité</dt><dd>{numberFormat.format(entry.quantity)}</dd></div>
                <div><dt>Prix unitaire</dt><dd><Kamas value={entry.unitPriceKamas} />{entry.lotSize > 1 && <small> lot ×{entry.lotSize}</small>}</dd></div>
                <div><dt>XP / unité</dt><dd>{numberFormat.format(entry.xpPerUnit)}</dd></div>
              </dl>
              <PriceAge date={entry.priceDate} />
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
