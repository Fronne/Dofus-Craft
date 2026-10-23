import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ROUTES } from './router';
import type { IconName } from '../components/Icon';

// specs/071 (contracts, « Site public »), after specs/050 (FR-004) and
// specs/053: what the address of a page shows while the owner has it off. One component for every page. `entry` is the
// first page still on, where the way out leads; without one, the site says it has no page at all.
export type PageEntry = { label: string; to: string; linkName: string };

// What the owner turning a page off does not delete, said for the pages that hold something of the visitor's.
const KEPT: Record<string, string> = { HDV: 'Vos prix sont conservés.', Forgemagie: 'Vos séances et vos données sont conservées.' };

export function PageUnavailable({ label, icon, entry }: { label: string; icon: IconName; entry: PageEntry | undefined }) {
  if (!entry) return <NoPageAvailable />;
  return (
    <>
      <header className="page-header">
        <h1>{label}</h1>
      </header>
      <EmptyState icon={icon} title={`${label} est momentanément indisponible`} description={`La page reviendra bientôt. ${KEPT[label] ?? 'Vos données sont conservées.'}`}>
        <Link to={entry.to} className="btn btn-primary">Aller à {entry.linkName}</Link>
      </EmptyState>
    </>
  );
}

// Every page is off: there is nowhere to send the visitor but the settings, which can't be turned off.
export function NoPageAvailable() {
  return (
    <>
      <header className="page-header">
        <h1>Dofus Craft</h1>
      </header>
      <EmptyState icon="settings" title="Aucune page n'est disponible pour le moment" description="Le site reviendra bientôt. Vos données sont conservées.">
        <Link to={ROUTES.settings} className="btn btn-primary">Ouvrir les paramètres</Link>
      </EmptyState>
    </>
  );
}
