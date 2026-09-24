// specs/012-modern-design: the two designs offered side by side while the player decides whether
// to keep the new one. Once decided, the one not kept is removed along with this setting.
export type DesignId = 'classic' | 'modern';

type Design = { id: DesignId; label: string };

export const designs: Design[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'modern', label: 'Nouveau' },
];

export function isKnownDesignId(designId: string): designId is DesignId {
  return designs.some((design) => design.id === designId);
}
