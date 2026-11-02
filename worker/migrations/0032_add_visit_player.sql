-- Visites du site liées au joueur connecté (le tableau de bord admin nomme les visiteurs du jour).
-- Additive : une colonne vide pour les visites déjà enregistrées, qui restent anonymes.
ALTER TABLE app_visits ADD COLUMN discord_user_id TEXT;
