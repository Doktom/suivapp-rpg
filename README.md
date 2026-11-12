# Suivapp RPG

> Variante « RPG coloré et décalé » de [Suivapp](https://github.com/Doktom/suivapp), créée à partir de son tag `v0.4-base`. Mêmes fonctions, habillage « Taverne en pagaille » : quêtes (habitudes), missions (tâches), donjon (entraînement), butin (trophées), un héros qui s'équipe en montant de niveau, un boss de la semaine et un tavernier moqueur.

Webapp personnelle pour tenir ses **habitudes**, ses **tâches**, son **agenda** et son **entraînement** (sport, mobilité, danse), avec une progression ludique de style RPG : XP, niveaux et caractéristiques (Force, Souplesse, Grâce…).

Version de test : <https://doktom.github.io/suivapp-rpg/> (déployée à chaque envoi sur `main`, sans connexion : les données restent dans le navigateur). Version finale prévue sur un serveur privé (voir [docs/REPRISE.md](docs/REPRISE.md)).

## Ce que fait l'app

- **Aujourd'hui** : habitudes du jour par moment ou par famille, tâches dues, niveau et barre d'XP, correction des 13 derniers jours, bouton « Annuler » après chaque action.
- **Habitudes** : simple, niveaux (Rapide / Normal / Complet), routine à étapes, à éviter (heure limite, tolérance), durée, quantité ; fréquences quotidienne, en semaine, week-end, certains jours, X fois par semaine ou par mois, tous les N jours ; séries avec jour de grâce ; catalogue par famille.
- **Entraînement** :
  - *Sport* : programme de salle en rotation, séance guidée série par série (pré-remplie avec la dernière fois), chrono de repos, finisher (AMRAP, EMOM, for time, Tabata), records, courbes de progression, volume par semaine, éditeur de programme.
  - *Mobilité* : routines guidées au chrono (mise en position, tenue, côtés, bips) ou en coche, niveaux, série de jours.
  - *Danse* (salsa, bachata, kizomba) : cours fixes, soirées, pratique, temps par danse, figures, objectifs avec les moyens d'y arriver.
- **Tâches** : listes, blocs avec sous-tâches, tâches récurrentes (date fixe ou après réalisation), checklists réutilisables.
- **Agenda** : jour / semaine / mois, filtres, événements, entraînement et cours de danse ; on valide d'un toucher.
- **Progression** et **Réglages** : caractéristiques, thème clair / sombre, valeurs d'XP, export JSON.

Le détail est dans le [cahier des charges](docs/CAHIER_DES_CHARGES.md) ; l'avancement et la suite dans [docs/REPRISE.md](docs/REPRISE.md).

## Développement

```bash
npm ci
npm run dev     # puis ouvrir http://localhost:5173/suivapp-rpg/
npm test
npm run build
```

Sans fichier `.env.local`, l'app tourne en **mode démo** : les données restent dans le navigateur. Avec Supabase, copier `.env.example` en `.env.local` et le remplir.

Stack : React + TypeScript + Vite, Tailwind CSS v4, Supabase (Postgres + Auth + RLS), tests Vitest, hébergement GitHub Pages. Organisation du code : voir [`CLAUDE.md`](CLAUDE.md).

## Base de données Supabase (abandonnée, gardée pour mémoire)

Le site de test n'utilise plus Supabase. Les instructions ci-dessous ne servent que si on le rebranche.

**Nouvelle installation** (une fois) :
1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL, exécuter [`supabase/schema.sql`](supabase/schema.sql) (schéma complet).
3. Authentication → URL Configuration : mettre `https://doktom.github.io/suivapp-rpg/` en Site URL.
4. Dans le dépôt GitHub (Settings → Secrets and variables → Actions), ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis relancer le déploiement.
5. Se connecter une première fois, puis désactiver les inscriptions (Authentication → Sign In / Providers) pour que le compte reste unique.

**Mise à jour d'une base existante**, avant d'envoyer la nouvelle version :
- base V0.1 → exécuter [`migration_v0.2.sql`](supabase/migration_v0.2.sql) puis [`migration_v0.3.sql`](supabase/migration_v0.3.sql) ;
- base V0.2 → exécuter `migration_v0.3.sql`.

Les scripts se relancent sans risque et gardent les données. Le catalogue, le programme de salle et les routines de départ s'ajoutent tout seuls au premier chargement.

## Reprendre le travail avec Claude Code

Les fichiers `CLAUDE.md`, `docs/REPRISE.md` et le dossier `.claude/` (serveur de dev et commande `/reprise`) permettent de reprendre sur n'importe quel PC : ouvrir le dossier du dépôt dans Claude Code et taper `/reprise`.
