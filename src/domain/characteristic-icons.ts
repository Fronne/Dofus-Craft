// Characteristic icons for the Dofus "Statistiques" list (Vitalite, Force, Degats, ...).
// PNGs pulled from the Dofus 3 (Unity) client's uiassets bundle
// (Assets/UI/Themes/Figma/characteristics/characteristicIcon/2x/), copied as-is into
// public/characteristic-icons/, the same way public/category-icons/ holds equipment slot icons
// pulled from the client. DofusDB exposes each characteristic's name and this client-internal
// asset name (field `asset`, e.g. "tx_vitality") but no browsable icon URL. This set replaces
// the old Dofus 2 (Flash) client's characteristics.swf: it's more complete (the Dofus 2 file was
// missing dedicated icons for Tacle, Degats Melee, Degats Neutre, Resistance Distance/Melee —
// this one has all of them) and its resistance icons already have their own shield artwork, so
// CharacteristicIcon no longer needs to draw one in CSS.

// DofusDB characteristic id -> icon file under public/characteristic-icons/ (from GET
// /characteristics, field `asset`). id 31's own asset ("tx_weaponDamage") has no icon in this
// set; "tx_weapon" (weapon mastery) is the closest match.
export const CHARACTERISTIC_ASSET_BY_ID: Record<number, string> = {
  0: "tx_lifePoints",
  1: "tx_actionPoints",
  10: "tx_strength",
  11: "tx_vitality",
  12: "tx_wisdom",
  13: "tx_chance",
  14: "tx_agility",
  15: "tx_intelligence",
  16: "tx_damage",
  18: "tx_crit",
  19: "tx_range",
  23: "tx_movementPoints",
  25: "tx_damagesPercent",
  26: "tx_summonableCreaturesBoost",
  27: "tx_dodgeAP",
  28: "tx_dodgeMP",
  31: "tx_weapon",
  33: "tx_strengthRes",
  34: "tx_intelligenceRes",
  35: "tx_chanceRes",
  36: "tx_agilityRes",
  37: "tx_neutralRes",
  40: "tx_pods",
  44: "tx_initiative",
  48: "tx_prospecting",
  49: "tx_heal",
  50: "tx_return",
  54: "tx_strengthRes",
  55: "tx_intelligenceRes",
  56: "tx_chanceRes",
  57: "tx_agilityRes",
  58: "tx_neutralRes",
  69: "tx_trapPercent",
  70: "tx_trap",
  78: "tx_escape",
  79: "tx_tackle",
  82: "tx_attackAP",
  83: "tx_attackMP",
  84: "tx_push",
  85: "tx_pushReduction",
  86: "tx_criticalDamage",
  87: "tx_criticalReduction",
  88: "tx_strength",
  89: "tx_intelligence",
  90: "tx_chance",
  91: "tx_agility",
  92: "tx_neutral",
  120: "tx_distance",
  121: "tx_distanceRes",
  122: "tx_weapon",
  123: "tx_spells",
  124: "tx_resMelee",
  125: "tx_damageMelee",
  141: "tx_spellsRes",
  142: "tx_weaponRes",
};
