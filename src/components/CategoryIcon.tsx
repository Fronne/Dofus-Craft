import { Icon } from './Icon';

// Official Dofus slot icons, extracted from the Dofus 3 (Unity) client's uidarkstone bundle
// (Assets/UI/Themes/darkStone/texture/slot/icon_slot_<type>_inventory.png), except helmet.png:
// equipment-type-10 is DofusDB's "Chapeau" (hat), which that bundle's own "helmet" slot icon
// doesn't look like (a face-mask silhouette) — helmet.png is instead
// Assets/UI/Themes/Figma/icons/2x/shadow/helmetShadowOutline.png from the general icons bundle,
// a proper hat outline. Trophée et Prysmaradite share a single "Trophée" category (see
// TROPHY_CATEGORY_ID in dofusdb-mappers.ts), so they share this one icon too.
// Bump the ?v= query whenever these files change: the browser's image cache won't notice an
// edited public/ file at the same URL otherwise.
const CATEGORY_ICON_VERSION = 3;
export const CATEGORY_ICON_PATHS: Record<string, string> = {
  'equipment-type-1': `/category-icons/collar.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-2': `/category-icons/weapon.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-3': `/category-icons/ring.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-4': `/category-icons/belt.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-5': `/category-icons/shoe.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-7': `/category-icons/shield.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-10': `/category-icons/helmet.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-11': `/category-icons/cape.png?v=${CATEGORY_ICON_VERSION}`,
  'equipment-type-151': `/category-icons/trophy.png?v=${CATEGORY_ICON_VERSION}`,
};

// Inline variant (tinted via currentColor) used wherever a category icon sits next to text,
// as opposed to CategoryFilter's slot-styled buttons which tint against --slot-glyph instead.
export function CategoryIcon({ categoryId, size = 18 }: { categoryId: string; size?: number }) {
  const path = CATEGORY_ICON_PATHS[categoryId];
  if (!path) return <Icon name="package" size={size} />;
  return (
    <span
      className="category-icon-inline"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${path})`,
        maskImage: `url(${path})`,
      }}
    />
  );
}
