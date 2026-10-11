// specs/012-modern-design: the designs offered side by side in Paramètres. specs/032-cosmos-design
// adds « Cosmos », inspired by the Dofus 3 interface, as a third choice next to the other two.
export type DesignId = 'classic' | 'modern' | 'cosmos';

type Design = { id: DesignId; label: string };

export const designs: Design[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'modern', label: 'Nouveau' },
  { id: 'cosmos', label: 'Cosmos' },
];

export function isKnownDesignId(designId: string): designId is DesignId {
  return designs.some((design) => design.id === designId);
}
