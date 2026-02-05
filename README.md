# Cloud Azure - Application Web 3-Tiers

**Rapport Technique - TP Cloud Azure**

Application web complète déployée sur Microsoft Azure suivant une architecture 3-tiers (présentation, logique métier, données).

---

## Table des matières

- [Démonstration](#démonstration)
- [Architecture](#architecture)
- [Choix techniques et justifications](#choix-techniques-et-justifications)
- [Services Azure utilisés](#services-azure-utilisés)
- [Infrastructure as Code (Bicep)](#infrastructure-as-code-bicep)
- [CI/CD](#cicd)
- [Fonctionnalités](#fonctionnalités)
- [Structure du projet](#structure-du-projet)
- [Démarrage local](#démarrage-local)
- [Déploiement Azure](#déploiement-azure)
- [Difficultés rencontrées et solutions](#difficultés-rencontrées-et-solutions)
- [Estimation des coûts](#estimation-des-coûts)

---

## Démonstration

### Application déployée

| Composant | URL |
|-----------|-----|
| **Frontend** | https://app-cloudazure-frontend-dev.azurewebsites.net |
| **Frontend - Logs** | https://app-cloudazure-frontend-dev.azurewebsites.net/logs |
| **Backend API** | https://app-cloudazure-backend-dev.azurewebsites.net |
| **Azure Function** | https://func-cloudazure-logging-dev.azurewebsites.net |

### Fonctionnalités disponibles

- **Gestion de fichiers** : Upload, téléchargement, visualisation inline, suppression
- **Gestion de dossiers** : Création, navigation hiérarchique, renommage, déplacement, suppression
- **Organisation** : Déplacement de fichiers entre dossiers, filtrage et tri
- **Temps réel** : Synchronisation automatique via Server-Sent Events (SSE)
- **Visualisation** : Aperçu inline des images, PDF et fichiers texte
- **Logging** : Suivi d'activité via Azure Function avec page dédiée `/logs`
- **Stockage** : Azure Blob Storage (production) ou stockage local (développement)

---

## Architecture

### Schéma de l'architecture 3-tiers

```mermaid
flowchart TB
    subgraph RG1["Resource Group (rg-cloudazure-dev)"]
        subgraph Presentation["Tier Présentation"]
            Frontend["Frontend App Service<br/>(React + Vite)"]
        end

        subgraph Logic["Tier Logique Métier"]
            Backend["Backend App Service<br/>(Express + TypeScript)"]
        end

        subgraph Data["Tier Données"]
            PostgreSQL[("PostgreSQL<br/>Flexible Server")]
            Blob[("Blob Storage<br/>(Fichiers)")]
        end

        subgraph Services["Services Azure"]
            KeyVault["Key Vault<br/>(Secrets)"]
            AppConfig["App Configuration<br/>(Settings)"]
        end

        Frontend -->|API REST| Backend
        Backend -->|Prisma ORM| PostgreSQL
        Backend -->|Azure SDK| Blob
        Backend -.->|Managed Identity| KeyVault
        Backend -.->|Managed Identity| AppConfig
    end

    subgraph RG2["Resource Group (rg-cloudazure-func-dev)"]
        Function["Azure Function<br/>(Consumption)"]
        TableStorage[("Table Storage<br/>(Logs)")]
        Function --> TableStorage
    end

    Backend -->|HTTP| Function

    User((Utilisateur)) -->|HTTPS| Frontend
```

### Description des tiers

| Tier | Composant | Technologie | Rôle |
|------|-----------|-------------|------|
| **Présentation** | Frontend App Service | React + Vite + TypeScript | Interface utilisateur SPA |
| **Logique métier** | Backend App Service | Express + TypeScript + Prisma | API REST, traitement des requêtes |
| **Données** | PostgreSQL Flexible Server | PostgreSQL 16 | Persistance des données relationnelles |
| **Stockage** | Azure Blob Storage | Standard LRS | Stockage des fichiers uploadés |
| **FaaS** | Azure Function | Node.js 20 (Consumption) | Logging d'activité utilisateur |

### Flux de données

1. L'utilisateur interagit avec le **Frontend React** (SPA)
2. Le Frontend appelle l'**API REST** du Backend via HTTPS
3. Le Backend :
   - Stocke les métadonnées dans **PostgreSQL**
   - Upload/télécharge les fichiers vers **Blob Storage**
   - Récupère les secrets depuis **Key Vault**
   - Lit la configuration depuis **App Configuration**
   - Envoie les événements à l'**Azure Function** pour le logging

---

## Choix techniques et justifications

### Frontend - React + Vite + TypeScript

| Critère | Choix | Justification |
|---------|-------|---------------|
| **Framework** | React 18 | Écosystème mature avec une large communauté, composants réutilisables, excellente documentation |
| **Build tool** | Vite | Build ultra-rapide grâce à ESBuild, Hot Module Replacement (HMR) performant, configuration minimale |
| **Langage** | TypeScript | Typage statique pour une meilleure maintenabilité, détection d'erreurs à la compilation, autocomplétion IDE |
| **Styling** | CSS Modules | Isolation des styles par composant, pas de conflit de noms de classes |

**Alternatives considérées :**
- Vue.js : Également viable, mais React offre plus de ressources et tutoriels disponibles
- Angular : Trop lourd pour ce projet, courbe d'apprentissage plus importante

### Backend - Express + TypeScript + Prisma

| Critère | Choix | Justification |
|---------|-------|---------------|
| **Framework** | Express.js | Framework Node.js léger et flexible, minimaliste, large écosystème de middlewares |
| **Langage** | TypeScript | Cohérence avec le frontend (même langage), typage end-to-end avec Prisma |
| **ORM** | Prisma | Typage automatique des modèles, migrations simplifiées, excellent DX (Developer Experience) |
| **Validation** | Zod | Validation runtime avec inférence TypeScript |

**Alternatives considérées :**
- Python FastAPI : Excellentes performances mais nécessite un environnement différent
- .NET Core : Plus lourd à déployer, overkill pour ce projet
- NestJS : Trop structuré pour une API simple

### Base de données - Azure PostgreSQL Flexible Server

| Critère | Choix | Justification |
|---------|-------|---------------|
| **SGBD** | PostgreSQL | SGBD relationnel robuste, support JSON natif, extensions riches |
| **Service Azure** | Flexible Server | Meilleur rapport coût/performance que Single Server, plus de flexibilité |
| **SKU** | Burstable B1ms | Adapté au développement, possibilité de scaling vertical si besoin |
| **Version** | PostgreSQL 16 | Dernière version LTS avec améliorations de performances |

**Alternatives considérées :**
- Azure SQL Database : Plus coûteux, pas de tier gratuit
- Cosmos DB : Surdimensionné pour ce cas d'usage, modèle NoSQL non nécessaire
- MySQL Flexible Server : PostgreSQL offre plus de fonctionnalités avancées

### Modèle de déploiement - PaaS (Azure App Service)

| Critère | Choix | Justification |
|---------|-------|---------------|
| **Modèle** | PaaS | Simplicité de gestion, pas de gestion de l'infrastructure sous-jacente |
| **Service** | Azure App Service | Scaling automatique, intégration native CI/CD, SSL/TLS géré, slots de déploiement |
| **Plan** | B1 (Basic) | Suffisant pour le développement, possibilité d'upgrade vers Standard/Premium |
| **OS** | Linux | Moins coûteux que Windows, adapté à Node.js |

**Alternatives considérées :**
- Azure Container Apps (CaaS) : Plus complexe à configurer, pas nécessaire pour ce projet
- Azure Kubernetes Service (AKS) : Overkill, complexité de gestion des clusters
- Azure VM (IaaS) : Trop de gestion manuelle (OS, patches, scaling)

### Infrastructure as Code - Bicep

| Critère | Choix | Justification |
|---------|-------|---------------|
| **Langage** | Bicep | Imposé pour le projet |
| **Organisation** | Modules | Code réutilisable et maintenable, séparation des préoccupations |
| **Paramètres** | .bicepparam | Séparation environnements dev/prod, support des secrets via `readEnvironmentVariable()` |

**Alternatives considérées :**
- Terraform : Multi-cloud mais syntaxe HCL moins intégrée à Azure
- ARM Templates JSON : Verbose et difficile à maintenir
- Pulumi : Nécessite un runtime supplémentaire

---

## Services Azure utilisés

### Tableau récapitulatif

| Service | Nom de la ressource | SKU/Tier | Usage |
|---------|---------------------|----------|-------|
| **Resource Group** | rg-cloudazure-dev | - | Conteneur logique des ressources |
| **App Service Plan** | asp-cloudazure-dev | B1 (Basic) | Hébergement Frontend + Backend |
| **Web App Frontend** | app-cloudazure-frontend-dev | - | Application React (SPA) |
| **Web App Backend** | app-cloudazure-backend-dev | - | API Express REST |
| **PostgreSQL Flexible Server** | psql-cloudazure-dev | Burstable B1ms | Base de données relationnelle |
| **Storage Account** | stcloudazuredev | Standard LRS | Blob Storage pour fichiers |
| **Key Vault** | kv-cloudazure-dev | Standard | Stockage sécurisé des secrets |
| **App Configuration** | appcs-cloudazure-dev | Free | Configuration centralisée |
| **Function App** | func-cloudazure-logging-dev | Consumption (Y1) | Logging d'activité (FaaS) |

### Sécurité - Managed Identity

L'application utilise des **System-Assigned Managed Identities** pour l'authentification entre services Azure, éliminant le besoin de stocker des credentials dans le code.

```mermaid
flowchart LR
    Backend["Backend App Service<br/>(Managed Identity)"]

    Backend -->|"Storage Blob Data Contributor"| Storage[("Storage Account")]
    Backend -->|"Key Vault Secrets User"| KeyVault["Key Vault"]
    Backend -->|"App Configuration Data Reader"| AppConfig["App Configuration"]
```

**Rôles RBAC attribués :**

| Ressource cible | Rôle RBAC | Justification |
|-----------------|-----------|---------------|
| Storage Account | Storage Blob Data Contributor | Upload/download/delete de blobs |
| Key Vault | Key Vault Secrets User | Lecture des secrets (connection strings) |
| App Configuration | App Configuration Data Reader | Lecture des paramètres de configuration |

---

## Infrastructure as Code (Bicep)

### Structure des modules

```
infra/
├── main.bicep                 # Template principal (orchestration)
├── modules/
│   ├── appservice.bicep       # App Service Plan + 2 Web Apps
│   ├── database.bicep         # PostgreSQL Flexible Server
│   ├── storage.bicep          # Storage Account + Container Blob
│   ├── keyvault.bicep         # Key Vault + Secrets + RBAC
│   ├── appconfig.bicep        # App Configuration + Settings
│   └── functionapp.bicep      # Function App (Consumption)
└── parameters/
    ├── dev.bicepparam         # Paramètres développement
    └── prod.bicepparam        # Paramètres production
```

### Description des modules

#### `main.bicep` - Orchestration
- Définit le scope au niveau subscription
- Crée les Resource Groups
- Orchestre le déploiement de tous les modules
- Gère les dépendances entre modules (outputs → inputs)

#### `appservice.bicep` - Hébergement
- App Service Plan Linux (B1)
- Web App Frontend avec Node.js 20 LTS
- Web App Backend avec Node.js 20 LTS
- System-Assigned Managed Identity pour chaque app
- Variables d'environnement configurées automatiquement

#### `database.bicep` - Base de données
- PostgreSQL Flexible Server (Burstable B1ms)
- Configuration haute disponibilité désactivée (dev)
- Firewall rule pour autoriser les services Azure
- Génération automatique de la connection string

#### `storage.bicep` - Stockage
- Storage Account Standard LRS
- Container Blob "uploads" pour les fichiers
- Génération de la connection string pour les Functions

#### `keyvault.bicep` - Secrets
- Key Vault Standard
- RBAC enabled (pas d'access policies legacy)
- Stockage du secret DATABASE_URL
- Attribution des rôles aux Managed Identities

#### `appconfig.bicep` - Configuration
- App Configuration Free tier
- Paramètres centralisés (container name, etc.)
- RBAC pour le backend

#### `functionapp.bicep` - FaaS
- Consumption Plan (Y1) pour paiement à l'usage
- Function App Linux avec Node.js 20
- Connexion au Storage Account pour Table Storage

### Commande de déploiement

```bash
az deployment sub create \
  --location swedencentral \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters dbAdminPassword='<MOT_DE_PASSE>'
```

---

## CI/CD

### GitHub Actions Workflows

Le projet utilise **GitHub Actions** avec 4 workflows distincts pour un déploiement automatisé.

```
.github/workflows/
├── deploy-infra.yml      # Infrastructure Bicep
├── deploy-backend.yml    # Backend Express
├── deploy-frontend.yml   # Frontend React
└── deploy-functions.yml  # Azure Function
```

### Authentification Azure (OIDC vs Publish Profile)

Les workflows utilisent **OpenID Connect (OIDC)** avec Workload Identity Federation pour l'authentification, évitant le stockage de secrets de longue durée.

#### Comparaison des méthodes d'authentification

| Aspect | Publish Profile | OIDC (notre choix) |
|--------|-----------------|---------------------|
| **Secrets GitHub** | 1 (`AZURE_WEBAPP_PUBLISH_PROFILE`) | 3 (`CLIENT_ID`, `TENANT_ID`, `SUBSCRIPTION_ID`) |
| **Type de credentials** | Credentials FTPS statiques | Token temporaire (sans mot de passe) |
| **Sécurité** | ⚠️ Si le secret fuite, accès complet | ✅ Aucun secret réel stocké |
| **Expiration** | Peut expirer, nécessite régénération | Jamais d'expiration |
| **Rotation** | Manuelle | Automatique (tokens temporaires) |
| **Recommandation Microsoft** | Ancienne méthode | ✅ Méthode recommandée |
| **Scope** | Limité à une Web App | Accès à toute la subscription |

#### Pourquoi OIDC ?

1. **Sécurité renforcée** : Aucun mot de passe n'est stocké dans GitHub. Les identifiants (`CLIENT_ID`, `TENANT_ID`, `SUBSCRIPTION_ID`) sont des identifiants publics, pas des secrets.

2. **Fonctionnement** : GitHub génère un token JWT signé → Azure le vérifie via la relation de confiance (Federated Credential) → Azure émet un token d'accès temporaire.

3. **Zéro secret à rotation** : Pas de credentials qui expirent ou peuvent fuiter.

#### Configuration utilisée

```yaml
permissions:
  id-token: write   # Permet à GitHub de générer un token OIDC
  contents: read

- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Workflow 1 : Infrastructure (`deploy-infra.yml`)

**Déclencheur :** Push sur `infra/**` ou dispatch manuel

```mermaid
flowchart LR
    A[Checkout] --> B[Azure Login<br/>OIDC]
    B --> C[Validate Bicep]
    C --> D[Deploy Bicep<br/>what-if + run]
```

**Étapes :**
1. Checkout du code
2. Connexion Azure via OIDC
3. Validation du template Bicep (`az bicep build`)
4. Déploiement avec `az deployment sub create`

### Workflow 2 : Backend (`deploy-backend.yml`)

**Déclencheur :** Push sur `backend/**` ou dispatch manuel

```mermaid
flowchart LR
    A[Checkout] --> B[Setup Node.js 20]
    B --> C[npm ci]
    C --> D[Prisma Generate]
    D --> E[TypeScript Build]
    E --> F[Deploy App Service]
    F --> G[Prisma Migrate]
```

**Étapes :**
1. Checkout du code
2. Setup Node.js 20
3. `npm ci` (installation des dépendances)
4. `npx prisma generate` (génération du client Prisma)
5. `npm run build` (compilation TypeScript)
6. Déploiement sur App Service via `azure/webapps-deploy@v3`
7. Exécution des migrations Prisma

### Workflow 3 : Frontend (`deploy-frontend.yml`)

**Déclencheur :** Push sur `frontend/**` ou dispatch manuel

**Étapes :**
1. Checkout du code
2. Setup Node.js 20
3. `npm ci`
4. `npm run build` (build Vite production)
5. Déploiement sur App Service

### Workflow 4 : Azure Function (`deploy-functions.yml`)

**Déclencheur :** Push sur `functions/**` ou dispatch manuel

**Étapes :**
1. Checkout du code
2. Setup Node.js 20
3. `npm ci`
4. `npm run build`
5. Déploiement via `azure/functions-action@v1`

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Client ID du Service Principal (OIDC) |
| `AZURE_TENANT_ID` | Tenant ID Azure AD |
| `AZURE_SUBSCRIPTION_ID` | ID de la subscription Azure |
| `DB_ADMIN_PASSWORD` | Mot de passe administrateur PostgreSQL |

---

## Fonctionnalités

### Upload de fichiers (Blob Storage)

L'application permet l'upload de fichiers vers Azure Blob Storage avec stockage des métadonnées en base de données.

**Flux d'upload :**
```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend API
    participant S as Blob Storage
    participant DB as PostgreSQL

    U->>F: Sélectionne fichier
    F->>B: POST /api/files (multipart)
    B->>S: Upload blob
    S-->>B: URL du blob
    B->>DB: INSERT metadata
    DB-->>B: File record
    B-->>F: 201 Created + file data
    F-->>U: Affiche fichier
```

### Synchronisation temps réel (SSE)

L'application utilise **Server-Sent Events** pour synchroniser automatiquement l'interface entre plusieurs utilisateurs.

```mermaid
sequenceDiagram
    participant A as Client A
    participant B as Backend (Express)
    participant C as Client B

    A->>B: GET /api/events (SSE Connect)
    C->>B: GET /api/events (SSE Connect)
    Note over A,C: Connexions SSE établies

    A->>B: POST /api/files (Upload)
    B-->>A: event: file:added
    B-->>C: event: file:added
    Note over A,C: Mise à jour instantanée
```

**Avantages :**
- Mise à jour instantanée sans refresh
- Connexion légère (unidirectionnelle)
- Reconnexion automatique en cas de coupure

### Gestion des dossiers

L'application supporte une arborescence hiérarchique de dossiers avec chemins normalisés.

**Modèle de données :**
```mermaid
erDiagram
    Folder ||--o{ File : contains
    Folder ||--o{ Folder : "parent/children"

    Folder {
        uuid id PK
        string name
        string path UK
        uuid parentId FK
        datetime createdAt
        datetime updatedAt
    }

    File {
        uuid id PK
        string name
        string url
        int size
        string mimeType
        uuid folderId FK
        datetime createdAt
        datetime updatedAt
    }
```

**Fonctionnalités :**
- Navigation hiérarchique (breadcrumb)
- Création de sous-dossiers
- Renommage avec mise à jour cascade des chemins enfants
- Déplacement de dossiers (avec validation anti-boucle)
- Suppression (uniquement si vide)

### API REST

#### Health Check

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/health` | GET | Health check de l'API avec infos de configuration |

#### Files (Fichiers)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/files` | GET | Liste tous les fichiers (optionnel: `?folderId=xxx`) |
| `/api/files/:id` | GET | Récupère les métadonnées d'un fichier |
| `/api/files/download/:fileName` | GET | Télécharge ou visualise un fichier (`?download=true` pour forcer) |
| `/api/files` | POST | Upload d'un nouveau fichier (multipart/form-data) |
| `/api/files/:id` | DELETE | Supprime un fichier par ID |
| `/api/files/:id/move` | PATCH | Déplace un fichier vers un autre dossier |
| `/api/files/config/info` | GET | Informations de configuration (debug) |

#### Folders (Dossiers)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/folders` | GET | Liste tous les dossiers avec compteurs |
| `/api/folders/:id` | GET | Récupère un dossier avec son contenu (fichiers + sous-dossiers) |
| `/api/folders/root/contents` | GET | Récupère le contenu de la racine |
| `/api/folders/path/*` | GET | Récupère un dossier par son chemin (ex: `/api/folders/path/documents/photos`) |
| `/api/folders` | POST | Crée un nouveau dossier (`{name, parentId?}`) |
| `/api/folders/:id` | DELETE | Supprime un dossier vide |
| `/api/folders/:id` | PATCH | Renomme un dossier (`{name}`) |
| `/api/folders/:id/move` | PATCH | Déplace un dossier (`{parentId}`) |

#### Logs (Proxy vers Azure Function)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/logs` | GET | Récupère les logs (`?date=YYYY-MM-DD&action=upload&limit=100`) |
| `/api/logs` | POST | Enregistre une activité manuellement |
| `/api/logs/stats` | GET | Statistiques agrégées par type d'action |

#### Server-Sent Events (Temps réel)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/events` | GET | Flux SSE pour mises à jour temps réel (`?folderId=xxx`) |

**Événements SSE disponibles :**
- `file:added` - Nouveau fichier uploadé
- `file:deleted` - Fichier supprimé
- `file:moved` - Fichier déplacé
- `folder:added` - Nouveau dossier créé
- `folder:deleted` - Dossier supprimé

### Azure Function - Logging (FaaS)

La Function App implémente 3 fonctions pour la gestion des logs d'activité :

| Fonction | Trigger | Endpoint | Description |
|----------|---------|----------|-------------|
| **logActivity** | HTTP POST | `/api/logActivity` | Enregistre une activité |
| **getLogs** | HTTP GET | `/api/getLogs` | Récupère les logs avec filtres |
| **cleanupLogs** | Timer | CRON `0 0 2 * * *` | Supprime les logs > 30 jours |

**Types d'activités loggées :**
- `upload` : Upload d'un fichier
- `download` : Téléchargement d'un fichier
- `view` : Visualisation inline d'un fichier
- `delete` : Suppression d'un fichier
- `list` : Consultation de la liste
- `file_moved` : Déplacement d'un fichier
- `folder_created` : Création d'un dossier
- `folder_deleted` : Suppression d'un dossier
- `folder_renamed` : Renommage d'un dossier
- `folder_moved` : Déplacement d'un dossier
- `error` : Erreur critique

**Stockage :** Azure Table Storage (table `ActivityLogs`), partitionné par date (YYYY-MM-DD)

**Exemple d'appel :**
```bash
# Enregistrer une activité
curl -X POST https://func-cloudazure-logging-dev.azurewebsites.net/api/logActivity \
  -H "Content-Type: application/json" \
  -d '{"action": "upload", "fileName": "document.pdf", "fileSize": 1024}'

# Récupérer les logs du jour
curl "https://func-cloudazure-logging-dev.azurewebsites.net/api/getLogs?date=2024-01-15"
```

---

## Structure du projet

```
cloud-azure/
├── README.md                    # Documentation et rapport technique
├── PLAN.md                      # Plan de développement initial
├── Makefile                     # Commandes Docker simplifiées
├── docker-compose.yml           # Configuration Docker dev
├── docker-compose.dev.yml       # Configuration Docker dev (hot reload)
│
├── frontend/                    # Application React (Tier Présentation)
│   ├── src/
│   │   ├── components/          # Composants React
│   │   │   ├── FileList.tsx     # Liste des fichiers avec filtres
│   │   │   ├── FileUpload.tsx   # Formulaire d'upload
│   │   │   ├── FileViewer.tsx   # Visualisation inline
│   │   │   └── FolderManager.tsx # Gestion des dossiers
│   │   ├── pages/
│   │   │   ├── HomePage.tsx     # Page principale (file manager)
│   │   │   └── LogsPage.tsx     # Page des logs d'activité
│   │   ├── api/                 # Services API (fetch)
│   │   │   ├── files.ts         # API fichiers
│   │   │   ├── folders.ts       # API dossiers
│   │   │   ├── logs.ts          # API logs
│   │   │   └── sse.ts           # Hook SSE temps réel
│   │   ├── hooks/
│   │   │   └── useFileFilters.ts # Hook filtrage/tri
│   │   ├── App.tsx              # Routes React Router
│   │   └── main.tsx             # Point d'entrée
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # API Express (Tier Logique métier)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── files.ts         # CRUD fichiers + upload
│   │   │   ├── folders.ts       # CRUD dossiers
│   │   │   ├── logs.ts          # Proxy vers Azure Function
│   │   │   └── sse.ts           # Server-Sent Events
│   │   ├── services/
│   │   │   ├── storage.ts       # Azure Blob Storage
│   │   │   ├── local-storage.ts # Stockage local (dev)
│   │   │   ├── bootstrap.ts     # Init Key Vault + App Config
│   │   │   ├── config.ts        # Configuration
│   │   │   ├── logging.ts       # Service de logging
│   │   │   ├── prisma.ts        # Client Prisma
│   │   │   └── sse.ts           # Service SSE (broadcast)
│   │   └── index.ts             # Point d'entrée Express
│   ├── prisma/
│   │   └── schema.prisma        # Schéma BDD (File, Folder)
│   ├── package.json
│   └── tsconfig.json
│
├── functions/                   # Azure Functions (FaaS)
│   └── logging/
│       ├── src/functions/
│       │   ├── logActivity.ts   # POST - Enregistrer activité
│       │   ├── getLogs.ts       # GET - Récupérer logs
│       │   └── cleanupLogs.ts   # Timer - Nettoyage auto (2h du matin)
│       ├── package.json
│       ├── host.json
│       └── tsconfig.json
│
├── infra/                       # Infrastructure Bicep (IaC)
│   ├── main.bicep               # Template principal (scope: subscription)
│   ├── modules/
│   │   ├── appservice.bicep     # App Service Plan + 2 Web Apps
│   │   ├── database.bicep       # PostgreSQL Flexible Server
│   │   ├── storage.bicep        # Storage Account + Container
│   │   ├── keyvault.bicep       # Key Vault + Secrets + RBAC
│   │   ├── appconfig.bicep      # App Configuration
│   │   └── functionapp.bicep    # Function App (Consumption)
│   └── parameters/
│       ├── dev.bicepparam
│       └── prod.bicepparam
│
└── .github/workflows/           # CI/CD GitHub Actions
    ├── deploy-infra.yml         # Déploiement infrastructure
    ├── deploy-backend.yml       # Build + Deploy backend
    ├── deploy-frontend.yml      # Build + Deploy frontend
    └── deploy-functions.yml     # Build + Deploy Azure Function
```

### Routes Frontend

| Route | Page | Description |
|-------|------|-------------|
| `/` | HomePage | Gestionnaire de fichiers principal |
| `/file/:id` | FileViewer | Visualisation d'un fichier |
| `/logs` | LogsPage | Consultation des logs d'activité |

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
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

```bash
# Mode production avec Nginx
make prod-nginx
```

**URL en production locale :** http://localhost:8080

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

1. **Azure CLI** installé et connecté (`az login`)
2. **Subscription Azure** active
3. **Service Principal** avec les droits Contributor et accès OIDC configuré

### Étape 1 : Configurer les secrets GitHub

Dans **Settings > Secrets and variables > Actions** :

| Secret | Valeur |
|--------|--------|
| `AZURE_CLIENT_ID` | Client ID du Service Principal |
| `AZURE_TENANT_ID` | Tenant ID Azure AD |
| `AZURE_SUBSCRIPTION_ID` | ID de la subscription |
| `DB_ADMIN_PASSWORD` | Mot de passe PostgreSQL sécurisé |

### Étape 2 : Déployer l'infrastructure

Option 1 - **Via GitHub Actions** (recommandé) :
- Push sur la branche `main` dans le dossier `infra/`
- Le workflow se déclenche automatiquement

Option 2 - **Manuellement** :
```bash
az deployment sub create \
  --location swedencentral \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters dbAdminPassword='<MOT_DE_PASSE>'
```

### Étape 3 : Déployer les applications

Les workflows GitHub Actions se déclenchent automatiquement sur push :

| Dossier modifié | Workflow déclenché |
|-----------------|-------------------|
| `infra/**` | `deploy-infra.yml` |
| `backend/**` | `deploy-backend.yml` |
| `frontend/**` | `deploy-frontend.yml` |
| `functions/**` | `deploy-functions.yml` |

---

## Difficultés rencontrées et solutions

### 1. Managed Identity et RBAC

**Problème :** La Managed Identity du backend n'avait pas les permissions nécessaires pour accéder au Storage Account. Les requêtes échouaient avec une erreur `403 Forbidden`.

**Cause :** Les role assignments RBAC n'étaient pas créés dans les templates Bicep.

**Solution :** Ajout des role assignments dans `keyvault.bicep` et `storage.bicep` :
```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, backendPrincipalId, 'Storage Blob Data Contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: backendPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

### 2. PostgreSQL Flexible Server - Firewall

**Problème :** Le backend App Service ne pouvait pas se connecter à PostgreSQL. Erreur de timeout lors des requêtes Prisma.

**Cause :** Par défaut, PostgreSQL Flexible Server bloque toutes les connexions entrantes.

**Solution :** Activation de "Allow public access from any Azure service" dans le module Bicep :
```bicep
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}
```

### 3. Variables d'environnement et secrets Bicep

**Problème :** Le mot de passe de la base de données devait être passé de manière sécurisée dans les pipelines CI/CD sans l'exposer dans le code.

**Solution :** Utilisation de `readEnvironmentVariable()` dans les fichiers `.bicepparam` :
```bicep
param dbAdminPassword = readEnvironmentVariable('DB_ADMIN_PASSWORD')
```

Et dans le workflow GitHub Actions :
```yaml
env:
  DB_ADMIN_PASSWORD: ${{ secrets.DB_ADMIN_PASSWORD }}
```

### 4. CORS Frontend/Backend

**Problème :** Erreurs CORS lors des appels API depuis le frontend déployé vers le backend.

**Cause :** Le backend n'autorisait pas l'origine du frontend App Service.

**Solution :** Configuration CORS dynamique dans Express :
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

### 5. Prisma sur App Service Linux

**Problème :** Le client Prisma ne se générait pas correctement au déploiement. Erreur `@prisma/client did not initialize yet`.

**Cause :** La commande `prisma generate` n'était pas exécutée dans le pipeline CI/CD.

**Solution :** Ajout explicite dans le workflow :
```yaml
- name: Generate Prisma Client
  run: npx prisma generate
  working-directory: backend

- name: Run database migrations
  run: npx prisma migrate deploy
  working-directory: backend
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 6. Frontend React en mode production

**Problème :** Le frontend React ne servait pas correctement les routes SPA après le build. Les routes directes (ex: `/files`) retournaient une erreur 404.

**Cause :** Azure App Service utilise `serve` par défaut qui ne gère pas correctement le fallback SPA.

**Solution :** Utilisation de **Nginx** avec une configuration personnalisée :
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 7. Azure Function - Cold Start

**Problème :** Latence importante lors du premier appel à l'Azure Function (cold start).

**Cause :** Le plan Consumption met en veille les instances après inactivité.

**Solution :** Accepté comme compromis coût/performance pour l'environnement de dev. En production, un plan Premium serait envisagé.

---

## Estimation des coûts

### Environnement de développement (mensuel)

| Service | SKU | Coût estimé | Notes |
|---------|-----|-------------|-------|
| **App Service Plan** | B1 (Basic) | ~13 € | 1 core, 1.75 GB RAM |
| **PostgreSQL Flexible Server** | Burstable B1ms | ~15 € | 1 vCore, 2 GB RAM |
| **Storage Account** | Standard LRS | ~1 € | < 10 GB estimé |
| **Key Vault** | Standard | ~0.03 €/secret | ~5 secrets |
| **App Configuration** | Free | 0 € | < 1000 requêtes/jour |
| **Function App** | Consumption | ~0 € | < 1M exécutions |
| **Bande passante** | - | ~1 € | Sortie < 5 GB |
| **Total estimé** | | **~30 €/mois** | |

### Optimisations de coûts appliquées

| Optimisation | Impact |
|--------------|--------|
| **PostgreSQL Burstable** | -50% vs General Purpose |
| **Storage LRS** | -40% vs GRS |
| **App Configuration Free** | Gratuit (vs Standard ~35€) |
| **Function Consumption** | Paiement à l'usage uniquement |
| **Région Sweden Central** | Coûts compétitifs en Europe |

### Projection environnement production

| Service | SKU Production | Coût estimé |
|---------|----------------|-------------|
| App Service Plan | S1 (Standard) | ~70 € |
| PostgreSQL | General Purpose D2s | ~120 € |
| Storage Account | Standard GRS | ~5 € |
| Function App | Premium EP1 | ~150 € |
| Application Gateway | Standard | ~30 € |
| **Total Production** | | **~375 €/mois** |

---

## Variables d'environnement

### Backend

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Nom du Storage Account | `stcloudazuredev` |
| `AZURE_STORAGE_CONTAINER_NAME` | Nom du container blob | `uploads` |
| `AZURE_KEYVAULT_NAME` | Nom du Key Vault | `kv-cloudazure-dev` |
| `AZURE_APPCONFIG_ENDPOINT` | Endpoint App Configuration | `https://appcs-....azconfig.io` |
| `AZURE_FUNCTION_URL` | URL de la Function App | `https://func-....azurewebsites.net` |
| `AZURE_FUNCTION_KEY` | Clé d'accès à la Function App | `xxxxxxxxxxxxxxxx` |
| `PORT` | Port du serveur | `3001` |

### Frontend

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de l'API backend | `https://app-...-backend.azurewebsites.net/api/files` |

---

## Auteur

Projet réalisé dans le cadre du TP Cloud Azure - Architecture 3-Tiers.

**Repository :** Accès donné à guilian.ganster@gmail.com (@gganster sur GitHub)

---

## Licence

Ce projet est à usage éducatif uniquement.
