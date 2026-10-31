# Implementation Plan: Bons plans HDV

**Branch**: `078-bons-plans-hdv` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/078-bons-plans-hdv/spec.md`

## Summary

Le client de relevé envoie, en plus du prix le moins cher d'un équipement, **chaque exemplaire en vente** (identifiant d'annonce, prix, lignes de jet). Le Worker les stocke dans une nouvelle table `hdv_listings` (rangées vues depuis moins de 24 h). Une nouvelle route publique renvoie les annonces fraîches d'un serveur. Le **calcul des bons plans est fait côté site**, par un module de domaine pur et testé (`src/domain/good-deals.ts`) qui réutilise les poids de stats de `brisage.ts` et les effets des objets de `brisage-items.json`. Il alimente la pastille (niveau 1) et la page « Bons plans » (niveau 2). Le seuil (25 % par défaut) est un réglage d'administration.

## Technical Context

**Language/Version**: TypeScript (site React + Vite, Worker Cloudflare) ; Rust pour le client de relevé (dépôt séparé `SniffSniffSquared`)

**Primary Dependencies**: aucune nouvelle (React Router, D1, Vitest existants)

**Storage**: Cloudflare D1, nouvelle table `hdv_listings` (migration `0028`) ; réglage du seuil dans `site_settings`

**Testing**: Vitest (unitaires du domaine et du Worker, intégration des pages) ; `cargo test` côté client

**Target Platform**: site web (desktop et mobile) + Worker Cloudflare

**Project Type**: application web + Worker + client Rust externe

**Performance Goals**: page « Bons plans » affichée en moins de 2 s ; calcul sur quelques milliers d'annonces sans bloquer l'interface

**Constraints**: plan gratuit Cloudflare (100 000 écritures D1 par jour au total, plafond de 5 000 lignes par clé et par jour) ; compatibilité avec les clients de relevé qui n'envoient pas les exemplaires (FR-014) ; aucune valeur inventée (principe I)

**Scale/Scope**: quelques amis, quelques milliers d'annonces fraîches par serveur au plus, un serveur affiché à la fois

## Constitution Check

*GATE: passe avant la recherche, re-vérifiée après la conception.*

| Principe | Verdict | Note |
|---|---|---|
| I. Données traçables | OK | Les annonces portent leur clé (`key_id`), leur serveur et leur date de vue ; l'âge est affiché. Les poids viennent de `brisage.ts` (déjà documenté « estimation »). Une annonce sans jet lisible est ignorée, jamais complétée. |
| II. Correction avant optimisation | OK | Règle de comparaison explicite, isolée dans `good-deals.ts`, avec tests : cas normaux, bornes (seuil exact, 3 comparables), entrées invalides (jets vides, prix aberrant). |
| III. Décisions explicables | OK | La pastille affiche le prix de référence, le nombre de comparables et l'économie ; la page détaille le calcul (survol / ligne dépliée). |
| IV. Changements ciblés | OK | Pas de dépendance nouvelle ; pas de refonte de la table des contributions ; le prix « moins cher » existant est inchangé. |
| V. Données utilisateur | OK | Aucune donnée personnelle : annonces du jeu seulement, purgées après 24 h. |

**Re-vérification après conception** : inchangée. Le seul point sensible est le plafond d'écritures D1 (voir research R5) ; la mesure de garde est prévue.

## Project Structure

### Documentation (this feature)

```text
specs/078-bons-plans-hdv/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sniffer-copies.md      # extension de POST /community-price/batch
│   └── bons-plans-api.md      # GET /bons-plans et réglage du seuil
└── tasks.md                   # produit par /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── good-deals.ts                # qualité d'un jet, voisins, prix attendu, verdict (pur)
├── features/
│   └── good-deals/
│       ├── BonsPlansPage.tsx        # niveau 2 : liste, tri, filtres
│       ├── useGoodDeals.ts          # lit /bons-plans, calcule les verdicts
│       └── GoodDealBadge.tsx        # niveau 1 : pastille réutilisable
└── app/AppShell.tsx                 # route + entrée de navigation (réglage de page)

worker/
├── migrations/0028_add_hdv_listings.sql
├── schema.sql                       # table hdv_listings
├── src/
│   ├── listings.ts                  # validation, écriture et lecture des annonces
│   ├── sniffer.ts                   # accepte `copies` dans une observation
│   ├── retention.ts                 # purge des annonces de plus de 24 h
│   └── index.ts                     # route GET /bons-plans

admin-worker/ + admin/               # champ « seuil bon plan » (pourcentage)

tests/unit/                          # good-deals, listings, sniffer-copies
tests/integration/                   # bons-plans-page, pastille sur l'objet

# Dépôt externe (livré à part) : D:\Documents\Projet Claude Code\SniffSniffSquared\sniffer
core/src/upload.rs                   # envoie `copies` pour les équipements
```

**Structure Decision**: on garde la séparation existante domaine / fonctionnalité / Worker. Le calcul vit dans le domaine côté site (testable sans base, déjà bundlé avec les données d'objets), le Worker ne fait que stocker et servir des annonces fraîches.

## Complexity Tracking

Aucune violation de la constitution à justifier.
