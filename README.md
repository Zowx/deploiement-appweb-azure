# Cloud Azure - Application Web 3-Tiers

Application web complète déployée sur Microsoft Azure suivant une architecture 3-tiers (présentation, logique métier, données).

---

## Table des matières

- [Architecture](#architecture)
- [Choix techniques](#choix-techniques)
- [Services Azure utilisés](#services-azure-utilisés)
- [Structure du projet](#structure-du-projet)
- [Démarrage local](#démarrage-local)
- [Déploiement Azure](#déploiement-azure)
- [CI/CD](#cicd)
- [Fonctionnalités](#fonctionnalités)
- [Estimation des coûts](#estimation-des-coûts)
- [Difficultés rencontrées](#difficultés-rencontrées)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Resource Group (rg-cloudtp-dev)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │     Frontend     │    │     Backend      │    │     PostgreSQL       │  │
│  │   App Service    │───▶│   App Service    │───▶│   Flexible Server    │  │
│  │     (React)      │    │    (Express)     │    │                      │  │
│  └──────────────────┘    └────────┬─────────┘    └──────────────────────┘  │
│                                   │                                         │
│                                   ▼                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │    Key Vault     │    │  Blob Storage    │    │  App Configuration   │  │
│  │    (Secrets)     │    │   (Fichiers)     │    │    (Settings)        │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  Azure Function  │  (FaaS - Logging)                                     │
│  │   Activity Logs  │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Description des tiers

| Tier | Composant | Rôle |
|------|-----------|------|
| **Présentation** | Frontend React (App Service) | Interface utilisateur SPA |
| **Logique métier** | Backend Express (App Service) | API REST, traitement des requêtes |
| **Données** | PostgreSQL Flexible Server | Persistance des données |

---

## Choix techniques

### Frontend - React + Vite + TypeScript

| Critère | Justification |
|---------|---------------|
| **React** | Framework mature avec un large écosystème, composants réutilisables |
| **Vite** | Build rapide, HMR performant, configuration minimale |
| **TypeScript** | Typage statique, meilleure maintenabilité, détection d'erreurs à la compilation |

### Backend - Express + TypeScript + Prisma

| Critère | Justification |
|---------|---------------|
| **Express** | Framework Node.js léger et flexible, large communauté |
| **TypeScript** | Cohérence avec le frontend, typage end-to-end |
| **Prisma** | ORM moderne avec typage automatique, migrations simplifiées |

### Base de données - Azure PostgreSQL Flexible Server

| Critère | Justification |
|---------|---------------|
| **PostgreSQL** | SGBD relationnel robuste, support JSON natif |
| **Flexible Server** | Meilleur rapport coût/performance que Single Server |
| **SKU Burstable B1ms** | Adapté au développement, scaling possible |

### Modèle de déploiement - PaaS (App Service)

| Critère | Justification |
|---------|---------------|
| **PaaS vs CaaS** | Simplicité de gestion, pas besoin de gérer les conteneurs |
| **App Service** | Scaling automatique, intégration native CI/CD, SSL géré |
| **Plan B1** | Tier basique suffisant pour le projet, slots de déploiement |

### Infrastructure as Code - Bicep

| Critère | Justification |
|---------|---------------|
| **Bicep** | Syntaxe native Azure, plus lisible que ARM JSON |
| **Modules** | Code réutilisable et maintenable |
| **Paramètres** | Séparation configuration dev/prod |

---

## Services Azure utilisés

| Service | SKU/Tier | Usage |
|---------|----------|-------|
| **App Service Plan** | B1 (Basic) | Hébergement Frontend + Backend |
| **Web App** x2 | - | Frontend React, Backend Express |
| **PostgreSQL Flexible Server** | Burstable B1ms | Base de données relationnelle |
| **Storage Account** | Standard LRS | Blob Storage pour les fichiers |
| **Key Vault** | Standard | Stockage sécurisé des secrets |
| **App Configuration** | Free | Configuration centralisée |
| **Function App** | Consumption | Logging d'activité (FaaS) |

### Sécurité - Managed Identity

L'application utilise des **Managed Identities** pour l'authentification entre services Azure :

- Le Backend App Service possède une System-Assigned Managed Identity
- Cette identité a les rôles RBAC nécessaires sur :
  - **Storage Account** : Storage Blob Data Contributor
  - **Key Vault** : Key Vault Secrets User
  - **App Configuration** : App Configuration Data Reader

Cela permet d'éviter de stocker des credentials dans le code ou les variables d'environnement.

---

## Structure du projet

```
cloud-azure/
├── README.md                    # Documentation (ce fichier)
├── PLAN.md                      # Plan de développement
├── Makefile                     # Commandes Docker simplifiées
├── docker-compose.yml           # Configuration Docker dev
├── docker-compose.prod.yml      # Configuration Docker prod
│
├── frontend/                    # Application React
│   ├── src/
│   │   ├── components/          # Composants React
│   │   ├── services/            # Services API
│   │   └── App.tsx              # Composant principal
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── backend/                     # API Express
│   ├── src/
│   │   ├── routes/              # Routes API
│   │   ├── services/            # Services métier
│   │   └── index.ts             # Point d'entrée
│   ├── prisma/
│   │   └── schema.prisma        # Schéma base de données
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── functions/                   # Azure Functions (FaaS)
│   └── logging/                 # Function App de logging
│       ├── src/
│       │   └── functions/
│       │       ├── logActivity.ts   # POST - Enregistrer une activité
│       │       ├── getLogs.ts       # GET - Récupérer les logs
│       │       └── cleanupLogs.ts   # Timer - Nettoyage automatique
│       ├── package.json
│       ├── host.json
│       └── tsconfig.json
│
├── infra/                       # Infrastructure Bicep
│   ├── main.bicep               # Template principal
│   ├── modules/
│   │   ├── appservice.bicep     # App Service Plan + Web Apps
│   │   ├── database.bicep       # PostgreSQL Flexible Server
│   │   ├── storage.bicep        # Storage Account + Container
│   │   ├── keyvault.bicep       # Key Vault + Secrets
│   │   ├── appconfig.bicep      # App Configuration
│   │   └── function.bicep       # Function App
│   └── parameters/
│       ├── dev.bicepparam       # Paramètres développement
│       └── prod.bicepparam      # Paramètres production
│
└── .github/
    └── workflows/
        ├── deploy-infra.yml     # Pipeline infrastructure
        ├── deploy-backend.yml   # Pipeline backend
        ├── deploy-frontend.yml  # Pipeline frontend
        └── deploy-function.yml  # Pipeline Azure Function
```

---

## Démarrage local

### Avec Docker (Recommandé)

```bash
# Démarrer en mode développement (hot reload)
make dev

# Voir les logs
make dev-logs

# Arrêter les services
make dev-stop
```

**URLs en développement :**
- Frontend : http://localhost:5173
- Backend : http://localhost:3001
- PostgreSQL : localhost:5432

```bash
# Mode production
make prod

# Avec Nginx reverse proxy (tout sur le port 8080)
make prod-nginx
```

**URLs en production locale :**
- Frontend : http://localhost:3000
- Backend : http://localhost:3001
- Application (Nginx) : http://localhost:8080

**Commandes utiles :**
```bash
make help       # Toutes les commandes disponibles
make clean      # Supprimer containers et volumes
make db-reset   # Réinitialiser la base de données
make db-shell   # Shell PostgreSQL
```

### Sans Docker

#### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configurer les variables
npx prisma generate
npx prisma migrate dev
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Déploiement Azure

### Prérequis

1. **Azure CLI** installé et connecté
2. **Subscription Azure** active
3. **Service Principal** avec les droits Contributor

### 1. Configurer les secrets GitHub

Dans les settings du repository GitHub, ajouter les secrets suivants :

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Client ID du Service Principal |
| `AZURE_TENANT_ID` | Tenant ID Azure AD |
| `AZURE_SUBSCRIPTION_ID` | ID de la subscription |
| `DB_ADMIN_PASSWORD` | Mot de passe admin PostgreSQL |

### 2. Déployer l'infrastructure manuellement

```bash
# Connexion Azure
az login

# Déploiement
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters dbAdminPassword='<MOT_DE_PASSE_SECURISE>'
```

### 3. Déploiement automatique (CI/CD)

Les workflows GitHub Actions se déclenchent automatiquement :

| Workflow | Déclencheur | Action |
|----------|-------------|--------|
| `deploy-infra.yml` | Push sur `infra/**` | Déploie l'infrastructure Bicep |
| `deploy-backend.yml` | Push sur `backend/**` | Build et déploie le backend |
| `deploy-frontend.yml` | Push sur `frontend/**` | Build et déploie le frontend |
| `deploy-function.yml` | Push sur `functions/**` | Déploie l'Azure Function |

---

## CI/CD

### Workflows GitHub Actions

#### Infrastructure (`deploy-infra.yml`)

1. Checkout du code
2. Connexion Azure (OIDC)
3. Validation du template Bicep
4. Déploiement avec `az deployment sub create`

#### Backend (`deploy-backend.yml`)

1. Checkout du code
2. Setup Node.js 20
3. Install dependencies
4. Build TypeScript
5. Generate Prisma client
6. Déploiement sur App Service

#### Frontend (`deploy-frontend.yml`)

1. Checkout du code
2. Setup Node.js 20
3. Install dependencies
4. Build Vite (production)
5. Déploiement sur App Service

#### Azure Function (`deploy-function.yml`)

1. Checkout du code
2. Setup Node.js 20
3. Install dependencies
4. Build TypeScript
5. Déploiement sur Function App

---

## Fonctionnalités

### Upload de fichiers (Blob Storage)

- Upload de fichiers vers Azure Blob Storage
- Liste des fichiers uploadés
- Suppression de fichiers
- Métadonnées stockées en PostgreSQL

### API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/files` | GET | Liste des fichiers |
| `/api/files` | POST | Upload d'un fichier |
| `/api/files/:id` | DELETE | Supprimer un fichier |

### Azure Function - Logging (FaaS)

La Function App `logging` implémente 3 fonctions pour la gestion des logs d'activité :

| Fonction | Trigger | Endpoint | Description |
|----------|---------|----------|-------------|
| **logActivity** | HTTP POST | `/api/logActivity` | Enregistre une activité dans Table Storage |
| **getLogs** | HTTP GET | `/api/getLogs` | Récupère les logs avec filtres optionnels |
| **cleanupLogs** | Timer | CRON `0 0 2 * * *` | Supprime les logs > 30 jours (2h UTC) |

**Types d'activités loggées :**
- `upload` : Upload d'un fichier
- `download` : Téléchargement d'un fichier
- `delete` : Suppression d'un fichier
- `list` : Consultation de la liste
- `error` : Erreur critique

**Exemple d'appel - Enregistrer une activité :**
```bash
curl -X POST https://<function-app>.azurewebsites.net/api/logActivity \
  -H "x-functions-key: <FUNCTION_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "upload",
    "fileName": "document.pdf",
    "fileSize": 1024,
    "userId": "user123"
  }'
```

**Exemple d'appel - Récupérer les logs :**
```bash
# Tous les logs du jour
curl "https://<function-app>.azurewebsites.net/api/getLogs?date=2024-01-15"

# Filtrer par action
curl "https://<function-app>.azurewebsites.net/api/getLogs?action=error&limit=50"
```

**Stockage :** Azure Table Storage (table `ActivityLogs`), partitionné par date (YYYY-MM-DD)

---

## Estimation des coûts

### Environnement de développement (mensuel)

| Service | Coût estimé |
|---------|-------------|
| App Service Plan B1 | ~13 € |
| PostgreSQL Flexible B1ms | ~15 € |
| Storage Account (LRS) | ~1 € |
| Key Vault | ~0.03 €/secret |
| App Configuration (Free) | 0 € |
| Function App (Consumption) | ~0 € |
| **Total estimé** | **~30 €/mois** |

### Optimisation des coûts

- **PostgreSQL** : Arrêt automatique possible hors heures de travail
- **App Service** : Tier B1 suffisant pour le dev, scaling vers S1 si besoin
- **Function App** : Plan Consumption = paiement à l'usage uniquement
- **Storage** : LRS (locally redundant) vs GRS pour réduire les coûts

---

## Difficultés rencontrées

### 1. Managed Identity et RBAC

**Problème** : La Managed Identity du backend n'avait pas les permissions sur le Storage Account.

**Solution** : Ajout des role assignments dans Bicep avec le rôle `Storage Blob Data Contributor`.

### 2. PostgreSQL Flexible Server - Firewall

**Problème** : Le backend App Service ne pouvait pas se connecter à PostgreSQL.

**Solution** : Configuration du VNet integration ou activation de "Allow Azure Services" dans les firewall rules.

### 3. Variables d'environnement Bicep

**Problème** : Passage du mot de passe DB via les paramètres Bicep dans GitHub Actions.

**Solution** : Utilisation de `readEnvironmentVariable()` dans le fichier `.bicepparam` et passage via `--parameters` additionnels.

### 4. CORS Frontend/Backend

**Problème** : Erreurs CORS lors des appels API depuis le frontend.

**Solution** : Configuration CORS dans Express pour autoriser l'origine du frontend App Service.

### 5. Prisma sur App Service Linux

**Problème** : Le client Prisma ne se générait pas correctement au déploiement.

**Solution** : Ajout de `npx prisma generate` dans le workflow CI/CD avant le build.

---

## Variables d'environnement

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `AZURE_STORAGE_ACCOUNT_NAME` | Nom du Storage Account |
| `AZURE_STORAGE_CONTAINER_NAME` | Nom du container blob |
| `AZURE_KEYVAULT_NAME` | Nom du Key Vault |
| `AZURE_APPCONFIG_ENDPOINT` | Endpoint App Configuration |
| `PORT` | Port du serveur (défaut: 3001) |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL de l'API backend |

---

## Auteur

Projet réalisé dans le cadre du TP Cloud Azure.

---

## Licence

Ce projet est à usage éducatif.