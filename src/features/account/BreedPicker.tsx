import { useState } from 'react';
import { BREEDS, portraitUrl } from '../../domain/breeds';

// specs/075-connexion-discord-site (US3): the 19 classes of the game, one of which is the player's icon. The
// portrait is the class's head (public/class-heads); a class whose portrait does not load shows its initial.

function BreedOption({ id, name, selected, disabled, onChoose }: {
  id: number; name: string; selected: boolean; disabled: boolean; onChoose: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      className={`breed-option${selected ? ' breed-option--selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onChoose}
    >
      {broken ? (
        <span className="breed-portrait breed-portrait--empty" aria-hidden="true">{name.charAt(0)}</span>
      ) : (
        <img className="breed-portrait" src={portraitUrl(id, 'm')} alt="" width={48} height={48} loading="lazy" onError={() => setBroken(true)} />
      )}
      <span className="breed-name">{name}</span>
    </button>
  );
}

export function BreedPicker({ breedId, disabled, onChange }: {
  breedId: number | null;
  disabled: boolean;
  onChange: (breedId: number | null) => void;
}) {
  return (
    <div className="breed-picker">
      <div className="breed-grid" role="group" aria-label="Classe">
        {BREEDS.map((breed) => (
          <BreedOption
            key={breed.id}
            id={breed.id}
            name={breed.name}
            selected={breed.id === breedId}
            disabled={disabled}
            onChoose={() => onChange(breed.id)}
          />
        ))}
      </div>
      <button type="button" className="btn btn-secondary btn-small" disabled={disabled || breedId === null} onClick={() => onChange(null)}>
        Retirer mon icône
      </button>
    </div>
  );
}
