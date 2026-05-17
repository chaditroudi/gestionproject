# Application Web de Gestion du Travail

Ce projet fournit un socle complet pour une application de gestion du travail en entreprise, conforme au cahier des charges du PFE.

Le cahier des charges complet est disponible dans [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md).

## Alignement avec le cahier des charges

- `frontend`: interface React pour la gestion des utilisateurs, equipes et taches.
- `backend`: API Node.js / Express avec authentification JWT et gestion des roles.
- `database`: schema PostgreSQL et donnees de demonstration.

## Fonctionnalites couvertes

- Authentification des utilisateurs.
- Gestion des roles: `admin`, `director`, `manager`, `team_lead`, `hr`, `employee`.
- Gestion des equipes et des responsables.
- Gestion des taches: creation, affectation, suivi, priorite et echeance.
- Tableau de bord de suivi avec indicateurs et liste des taches recentes.

## Correspondance fonctionnelle

- Gestion des utilisateurs : comptes, authentification JWT, roles et permissions.
- Gestion des equipes : creation, mise a jour, suppression, designation des responsables et rattachement des membres.
- Gestion des taches : creation, modification, suppression, affectation, suivi du statut, checklist, commentaires et pieces jointes.
- Suivi et reporting : tableau de bord, indicateurs globaux, progression par equipe et activite recente.

## Stack technique

- Frontend: React, React Router, CSS moderne.
- Backend: Node.js, Express, PostgreSQL.
- Securite: bcrypt pour les mots de passe, JWT pour les sessions, Helmet pour les en-tetes.

## Demarrage

1. Copier `.env.example` vers `.env`.
2. Lancer PostgreSQL avec Docker:

```bash
docker compose up -d
```

3. Installer les dependances:

```bash
npm install
```

4. Demarrer le backend:

```bash
npm run dev:backend
```

5. Demarrer le frontend dans un autre terminal:

```bash
npm run dev:frontend
```

## Compte de demonstration

- Email: `admin@company.com`
- Mot de passe: `Admin123!`

## API principale

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `GET /api/teams`
- `POST /api/teams`
- `PUT /api/teams/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `GET /api/dashboard/summary`

## Suite recommandee

- Ajouter des tests unitaires et d'integration.
- Ajouter des filtres avances et des pieces jointes.
- Mettre en place des notifications en temps reel.
- Deployer avec Docker ou une plateforme cloud.
# gestionproject
