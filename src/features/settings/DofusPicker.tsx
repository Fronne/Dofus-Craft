import { dofusThemes, type DofusId } from '../../domain/dofus-themes';

// specs/074-dofus-color-themes (contracts/ui-contract.md §1): the six primordial Dofus, each a
// button that gives the site its colors. The name sits in the button, so the picture has no alt.
export function DofusPicker({ dofus, setDofus }: { dofus: DofusId; setDofus: (value: DofusId) => void }) {
  return (
    <div className="settings-choice-row">
      {dofusThemes.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={dofus === entry.id ? 'settings-choice settings-choice-dofus selected' : 'settings-choice settings-choice-dofus'}
          aria-pressed={dofus === entry.id}
          onClick={() => setDofus(entry.id)}
        >
          <img src={entry.image} alt="" width="56" height="56" />
          <span>{entry.name}</span>
        </button>
      ))}
    </div>
  );
}
