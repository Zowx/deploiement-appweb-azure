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
- [Performances, Sécurité & Résilience](#performances-sécurité--résilience)
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
    User((Utilisateur)) -->|HTTPS| PIP["Public IP<br/>(Standard Static)"]

    PIP --> AppGW["Application Gateway WAF_v2<br/>(Reverse Proxy + WAF)<br/>snet-appgw: 10.0.1.0/24"]

    subgraph VNet["VNet (10.0.0.0/16)"]
        subgraph AppGWSubnet["Subnet AppGw (10.0.1.0/24)"]
            AppGW
            NSG["NSG<br/>(Règles trafic)"]
        end

        subgraph AppSubnet["Subnet Apps (10.0.2.0/24)"]
            Frontend["Frontend App Service<br/>(React + Vite)<br/>Reverse Proxy /api/*"]
            Backend["Backend App Service<br/>(Express + TypeScript)<br/>Access Restricted"]
        end
    end

    AppGW -->|HTTP/HTTPS<br/>Port 80/443| Frontend
    Frontend -->|HTTPS<br/>Reverse proxy| Backend

    subgraph Data["Données"]
        PostgreSQL[("PostgreSQL<br/>Flexible Server")]
        Blob[("Blob Storage<br/>(Fichiers)")]
    end

    subgraph Services["Services Azure"]
        KeyVault["Key Vault<br/>(Secrets)"]
        AppConfig["App Configuration<br/>(Settings)"]
        Monitor["Azure Monitor<br/>(Alertes + Dashboard)"]
    end

    subgraph Monitoring["Monitoring & Scaling"]
        Autoscale["Autoscale Settings<br/>(CPU-based: 1-3)"]
    end

    Backend -->|Prisma ORM| PostgreSQL
    Backend -->|Azure SDK| Blob
    Backend -.->|Managed Identity| KeyVault
    Backend -.->|Managed Identity| AppConfig
    Autoscale -.->|Scale Out/In| Frontend
    Monitor -.->|Métriques| Autoscale
    Monitor -.->|Alertes| User

    subgraph RG2["Resource Group (rg-cloudazure-func-dev)"]
        Function["Azure Function<br/>(Consumption)"]
        TableStorage[("Table Storage<br/>(Logs)")]
        Function --> TableStorage
    end

    Backend -->|HTTP| Function
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
| **Plan** | S1 (Standard) | Standard pour autoscaling, Always On et VNet integration |
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
| **App Service Plan** | asp-cloudazure-dev | S1 (Standard) | Hébergement Frontend + Backend (supporte autoscale) |
| **Web App Frontend** | app-cloudazure-frontend-dev | - | Application React (SPA) + Reverse Proxy |
| **Web App Backend** | app-cloudazure-backend-dev | - | API Express REST (accès restreint) |
| **PostgreSQL Flexible Server** | psql-cloudazure-dev | Burstable B1ms | Base de données relationnelle |
| **Storage Account** | stcloudazuredev | Standard LRS | Blob Storage pour fichiers |
| **Key Vault** | kv-cloudazure-dev | Standard | Stockage sécurisé des secrets |
| **App Configuration** | appcs-cloudazure-dev | Free | Configuration centralisée |
| **Function App** | func-cloudazure-logging-dev | Consumption (Y1) | Logging d'activité (FaaS) |
| **VNet** | vnet-cloudazure-dev | - | Réseau virtuel isolé (10.0.0.0/16) |
| **NSG** | nsg-appgw-cloudazure-dev | - | Filtrage trafic subnet App Gateway |
| **Application Gateway** | appgw-cloudazure-dev | WAF_v2 | Reverse proxy + WAF (sécurité) |
| **Public IP** | pip-appgw-cloudazure-dev | Standard Static | IP publique pour App Gateway |
| **Autoscale Settings** | as-cloudazure-dev | - | Autoscaling CPU-based (1-3 instances) |
| **Azure Monitor** | - | - | Alertes + Dashboard (métriques) |

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
├── main.bicep                 # Template principal (scope: subscription)
├── modules/
│   ├── appservice.bicep       # App Service Plan + 2 Web Apps
│   ├── database.bicep         # PostgreSQL Flexible Server
│   ├── storage.bicep          # Storage Account + Container
│   ├── keyvault.bicep         # Key Vault + Secrets + RBAC
│   ├── appconfig.bicep        # App Configuration
│   ├── functionapp.bicep      # Function App (Consumption)
│   ├── autoscale.bicep        # Règles autoscaling CPU
│   ├── vnet.bicep             # VNet + Subnet + NSG
│   ├── appgateway.bicep       # Application Gateway WAF_v2
│   ├── monitoring.bicep       # Azure Monitor alertes
│   └── frontdoor.bicep        # Azure Front Door (conditionnel)
└── parameters/
    ├── dev.bicepparam
    └── prod.bicepparam
```

### Description des modules

#### `main.bicep` - Orchestration
- Définit le scope au niveau subscription
- Crée les Resource Groups
- Orchestre le déploiement de tous les modules
- Gère les dépendances entre modules (outputs → inputs)

#### `appservice.bicep` - Hébergement
- App Service Plan Linux (S1 Standard)
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

#### `autoscale.bicep` - Autoscaling- Règles autoscaling basées sur le CPU
- Trigger scale-out: >70% CPU pendant 5 minutes (+1 instance)
- Trigger scale-in: <30% CPU pendant 5 minutes (-1 instance)
- Min: 1 instance, Max: 3 instances, Cooldown: 5 minutes
- Scope: App Service Plan S1 (Standard)

#### `vnet.bicep` - Networking- VNet: 10.0.0.0/16
- Subnet AppGw: 10.0.1.0/24 avec NSG
- NSG Rules: AllowGatewayManager (65200-65535), AllowHTTP (80), AllowHTTPS (443), AllowAzureLoadBalancer
- Service endpoint Microsoft.Web sur subnet
- Isolation réseau des applications

#### `appgateway.bicep` - WAF & Reverse Proxy- SKU: WAF_v2, capacity 1
- Backend pool: FQDN du backend App Service
- HTTP Settings: HTTPS 443, pickHostNameFromBackendAddress
- Listener: HTTP port 80
- Health probe: /health sur backend (vérifie connectivité BD + Storage)
- WAF: Mode Prevention, ruleset OWASP 3.2
- Limite upload: 100 MB

#### `monitoring.bicep` - Azure Monitor- 4 metric alerts: Response time >2s, HTTP 5xx >5, CPU >80%, Unhealthy hosts
- Dashboard avec 4 panneaux (métriques principales)
- Action Group pour notifications email
- Intégration avec Autoscale Settings

#### `frontdoor.bicep` - Multi-région Failover (Bonus)
- Azure Front Door Standard profile
- Support primary + secondary origin
- HTTPS redirect + health probes
- Actuellement désactivé (enableFrontDoor=false) car non supporté sur subscription étudiante
- Prêt pour activation en production

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

## Performances, Sécurité & Résilience

### 2.1 Scalabilité & Autoscaling

L'application bénéficie d'une autoscaling intelligente pour gérer les variations de charge.

**Configuration :**
- **App Service Plan :** Upgrade de B1 (Basic) vers S1 (Standard) pour supporter l'autoscaling
- **CPU-based autoscaling :**
  - Scale-out: >70% CPU pendant 5 minutes → +1 instance
  - Scale-in: <30% CPU pendant 5 minutes → -1 instance
  - Min: 1 instance, Max: 3 instances, Cooldown: 5 minutes
- **Always On :** Enabled sur Frontend et Backend pour éviter les cold starts
- **Bicep module :** `autoscale.bicep`

**Avantages :**
- Gestion automatique des pics de charge
- Réduction des coûts pendant les creux
- Performance constante pour les utilisateurs
- RTO/RPO amélioré avec les instances redondantes

---

### 2.2 Architecture réseau sécurisée

Une architecture réseau dédiée isole les applications et contrôle le trafic réseau.

```mermaid
flowchart LR
    Internet["Internet<br/>(Non approuvé)"]
    PIP["Public IP<br/>(pip-appgw)"]

    subgraph VNet["VNet (10.0.0.0/16)"]
        AppGWSubnet["Subnet AppGw<br/>(10.0.1.0/24)<br/>NSG"]
        AppSubnet["Subnet Apps<br/>(10.0.2.0/24)"]

        subgraph AppGWSubnet
            WAF["Application Gateway WAF_v2<br/>(Reverse Proxy)"]
        end

        subgraph AppSubnet
            Frontend["Frontend App Service<br/>(Proxy /api/*)"]
            Backend["Backend App Service<br/>(Access Restricted)"]
        end
    end

    Internet --> PIP
    PIP --> WAF
    WAF -->|HTTP/HTTPS| Frontend
    Frontend -->|HTTPS<br/>Reverse Proxy| Backend
    Backend -.->|Denied from Internet| Internet

    style Internet fill:#ff6b6b
    style WAF fill:#51cf66
    style Backend fill:#ffd43b
    style AppGWSubnet fill:#e8f5e9
    style AppSubnet fill:#fff3e0
```

**Configuration réseau :**
- **VNet :** 10.0.0.0/16 - Réseau isolé pour toutes les ressources
- **Subnet AppGw :** 10.0.1.0/24 - Accueil Application Gateway avec NSG
- **NSG Règles (snet-appgw) :**
  - AllowGatewayManager: Ports 65200-65535 (gestion App Gateway)
  - AllowHTTP: Port 80 (redirection vers HTTPS)
  - AllowHTTPS: Port 443 (trafic chiffré)
  - AllowAzureLoadBalancer: Probes de santé
  - DenyAll (implicite): Tout autre trafic refusé
- **Service Endpoint :** Microsoft.Web activé sur subnet (authentification sécurisée)
- **Bicep modules :** `vnet.bicep`, `appgateway.bicep`

**Avantages :**
- Isolation du backend du trafic Internet direct
- Contrôle granulaire du trafic réseau
- Conformité avec les standards de sécurité
- Prévention des accès directs non autorisés

---

### 2.3 Application Gateway + WAF

Application Gateway agit comme reverse proxy avec Web Application Firewall intégré.

**Configuration :**
- **SKU :** WAF_v2 (seul tier supportant WAF)
- **Capacity :** 1 (scaling automatique via autoscale)
- **Backend Pool :** FQDN du Backend App Service
- **HTTP Settings :**
  - Protocol: HTTPS
  - Port: 443
  - pickHostNameFromBackendAddress: Enabled (préserve le hostname)
  - Connection Draining: 60 secondes
- **Listener :**
  - Protocol: HTTP (port 80)
  - Redirection: HTTP → HTTPS
- **Health Probe :**
  - Path: `/health` (custom endpoint vérifiant l'état de l'app)
  - Interval: 30 secondes
  - Timeout: 30 secondes
  - Unhealthy threshold: 3
  - Vérifie: Connectivité PostgreSQL + Azure Blob Storage
- **WAF Policy :** Prevention mode, OWASP 3.2 ruleset
- **File Upload Limit :** 100 MB

**Flux de requête :**

```mermaid
flowchart LR
    Client["Client HTTPS"] --> WAF["App Gateway WAF_v2<br/>(Inspection WAF)"]
    WAF -->|"Health check /health"| Backend["Backend<br/>(HTTPS 443)"]
```

---

### 2.4 Règles WAF personnalisées (Custom Rules)

Au-delà des règles OWASP, trois règles personnalisées protègent l'application.

| Rule | Type | Description | Action |
|------|------|-------------|--------|
| **RateLimitPerIP** | RateLimitRule | 100 req/min par IP source, groupé par ClientAddr | Block (429 Too Many Requests) |
| **GeoFilter** | MatchRule | Block trafic depuis pays configurables (ex: CN, RU, KP) | Block (403 Forbidden) |
| **BlockBadBots** | MatchRule | Block User-Agents: sqlmap, nikto, nmap, masscan, dirbuster | Block (403 Forbidden) |

**Configuration d'exemple (Bicep) :**
```bicep
// Rate Limit Rule
resource rateLimitRule 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies/customRules@2023-09-01' = {
  name: 'RateLimitPerIP'
  properties: {
    action: 'Block'
    matchConditions: [
      {
        matchVariables: [
          { variableName: 'RemoteAddr' }
        ]
        operator: 'IPMatch'
        negationConditon: false
        matchValues: ['0.0.0.0/0']
      }
    ]
    priority: 1
    ruleType: 'RateLimitRule'
    rateLimitDuration: 'PT1M'
    rateLimitThreshold: 100
    groupByUserSession: [
      { groupByVariables: [ { variableName: 'ClientAddr' } ] }
    ]
  }
}
```

---

### 2.5 Tests de sécurité WAF

Tests de validation des règles WAF en environnement de test.

**Test SQL Injection :**
```bash
# Request
curl "http://<appgw-ip>/api/files?id=1 OR 1=1"

# Response
HTTP/403 Forbidden
X-Azure-WAFACTION: Blocked
```

**Test XSS (Cross-Site Scripting) :**
```bash
# Request
curl "http://<appgw-ip>/api/files?name=<script>alert(1)</script>"

# Response
HTTP/403 Forbidden
X-Azure-WAFACTION: Blocked
```

**Test Health Check (allowlisting) :**
```bash
# Request (trusted)
curl "http://<appgw-ip>/health"

# Response
HTTP/200 OK
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "dependencies": {
    "database": { "status": "ok", "latency_ms": 12 },
    "storage": { "status": "ok", "latency_ms": 45 }
  }
}
```

---

### 2.6 Restriction d'accès Backend

Le Backend App Service refuse tout accès direct d'Internet, forcing les clients via Application Gateway.

Voir la section Difficultés (point 11) pour les détails d'implémentation.

**Reverse Proxy Frontend (server.cjs) :**
Le Frontend implémente un reverse proxy Node.js natif (`server.cjs`) qui route les requêtes `/api/*` vers le Backend via HTTPS. Voir section Difficultés (point 11).

**Flux sécurisé :**

```mermaid
flowchart TB
    Client["Client Browser"] --> Frontend["Frontend App Service<br/>(URL publique)"]
    Frontend -->|"Reverse Proxy HTTPS"| Backend["Backend App Service<br/>(Accès restreint)"]
    Backend -.->|"Accepte uniquement"| AppGw["Subnet App Gateway"]
    Internet["Internet direct"] -.->|"Bloqué"| Backend
    style Internet fill:#ffcdd2
    style Backend fill:#c8e6c9
```

---

### 2.7 OAuth (Google)

Authentification via Google OAuth2 avec gestion de sessions.

**Configuration :**
- **Library :** passport-google-oauth20
- **Session Management :** express-session
- **Callback URL :** `/api/auth/google/callback` (via frontend proxy)

**Variables d'environnement requises :**
| Variable | Description | Exemple |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Client ID Google Cloud | `123456.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client secret | `GOCSPX-xxxxx` |
| `SESSION_SECRET` | Secret pour express-session | `change_this_in_prod_!!!` |
| `BASE_URL` | URL du backend | `https://app-...-backend-dev.azurewebsites.net` |
| `FRONTEND_URL` | URL du frontend | `https://app-...-frontend-dev.azurewebsites.net` |

**Flux OAuth :**
```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend
    participant G as Google OAuth

    U->>F: Clique "Sign in with Google"
    F->>B: GET /api/auth/google (via proxy)
    B->>G: Redirect to Google login
    G-->>U: Login form
    U->>G: Enter credentials
    G->>B: Redirect avec authorization code
    B->>G: Exchange code for token
    G-->>B: ID token + Access token
    B->>B: Store session
    B-->>F: Redirect to dashboard
    F-->>U: Logged in ✓
```

---

### 2.8 Monitoring avancé (Bonus)

Azure Monitor fournit visibilité complète sur l'application avec alertes proactives.

**Composants :**

**1. Metric Alerts (4 alerts) :**
| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| **Response Time** | Avg response time | >2000 ms | Email + Log |
| **HTTP 5xx Errors** | Count of 5xx responses | >5 per 5min | Email + Log |
| **CPU Usage** | Avg CPU % | >80% | Email + Autoscale trigger |
| **Unhealthy Backend Hosts** | Count | ≥1 | Email + Critical |

**2. Dashboard (Azure Portal) :**
4 panneaux avec métriques en temps réel :
- Response Time (line chart, 1h)
- HTTP Status Codes (stacked bar, 5xx focus)
- CPU & Memory (dual-axis, 1h)
- App Gateway Health (pie chart, active/unhealthy hosts)

**3. Action Group :**
- Email notification à `operations@company.com`
- Webhook vers système de ticketing optionnel
- Fréquence: Immediate

**4. Bicep module :** `monitoring.bicep`

**Exemple de configuration :**
```bicep
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'ResponseTimeAlert'
  location: 'global'
  properties: {
    description: 'Alert when response time > 2s'
    severity: 2
    enabled: true
    scopes: [ appService.id ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ResponseTime'
          metricName: 'ResponseTime'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 2000
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [ actionGroupRef ]
  }
}
```

---

### 2.9 Health Endpoint (Bonus)

Un endpoint `/health` pour vérifier l'état de l'application et ses dépendances.

**Endpoint :**
```
GET /health
```

**Réponse (200 OK) :**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime_ms": 3600000,
  "dependencies": {
    "database": {
      "status": "ok",
      "latency_ms": 12
    },
    "storage": {
      "status": "ok",
      "latency_ms": 45
    }
  }
}
```

**Réponse (503 Service Unavailable) :**
```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:31:00.000Z",
  "dependencies": {
    "database": {
      "status": "error",
      "error": "Connection timeout",
      "latency_ms": 30000
    },
    "storage": {
      "status": "ok",
      "latency_ms": 50
    }
  }
}
```

**Implémentation (Backend) :**
```typescript
app.get('/health', async (req, res) => {
  const start = Date.now();

  try {
    // Check PostgreSQL
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // Check Blob Storage
    const storageStart = Date.now();
    await container.getProperties();
    const storageLatency = Date.now() - storageStart;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime_ms: process.uptime() * 1000,
      dependencies: {
        database: { status: 'ok', latency_ms: dbLatency },
        storage: { status: 'ok', latency_ms: storageLatency }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: { status: 'error', error: error.message, latency_ms: Date.now() - start },
        storage: { status: 'unknown' }
      }
    });
  }
});
```

**Utilisation :**
- **App Gateway Health Probe :** Utilise ce endpoint pour valider la santé des backend instances
- **Azure Monitor Dashboard :** Affiche historique de disponibilité
- **Client Monitoring :** Clients peuvent vérifier l'état avant utilisation

---

### 2.10 Redondance multi-région (Bonus)

Azure Front Door fournit failover automatique entre régions pour la haute disponibilité.

**Configuration :**
- **SKU :** Front Door Standard
- **Profile Name :** frontdoor-cloudazure-dev
- **Primary Origin :** Backend App Service (Region 1)
- **Secondary Origin :** Backend App Service (Region 2 - si créée)
- **Health Probes :** Checks `/health` endpoint toutes les 30s
- **Routing Rules :** HTTPS redirect + path-based routing
- **Session Affinity :** Enabled (sticky sessions)

**État actuel :**
- **Bicep module :** `frontdoor.bicep` disponible
- **Statut :** Désactivé (`enableFrontDoor=false`)
- **Raison :** Azure Front Door n'est pas supporté sur les subscriptions étudiantes
- **Pour activer :** Basculer `enableFrontDoor=true` en production

**Architecture (si activée) :**

```mermaid
flowchart TB
    FD["Azure Front Door<br/>(SSL Termination)"]

    subgraph Region1["Region 1 : Sweden Central"]
        Origin1["Primary Origin<br/>(Active)"]
    end

    subgraph Region2["Region 2 : West Europe"]
        Origin2["Secondary Origin<br/>(Standby)"]
    end

    FD -->|"Active"| Origin1
    FD -.->|"Failover"| Origin2
```

- **Health Probe :** `/health` (intervalle 30s)
- **Failover :** Automatique si la région primaire est unhealthy
- **TTL :** 60 secondes (cache DNS)

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
│   │   ├── functionapp.bicep    # Function App (Consumption)
│   │   ├── autoscale.bicep      # Règles autoscaling CPU│   │   ├── vnet.bicep           # VNet + Subnet + NSG│   │   ├── appgateway.bicep     # Application Gateway WAF_v2│   │   ├── monitoring.bicep     # Azure Monitor alertes│   │   └── frontdoor.bicep      # Azure Front Door (conditionnel)
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

Pour la configuration OAuth, voir [Section 2.7 OAuth](#27-oauth-google).


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

### Infrastructure & Déploiement

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

### 8. Autorisation des consultations des fichiers

**Problème :** Blocage du visionnement des fichiers.

**Cause :** AllowBlobPublicAccess set a false dans le storage.bicep pour la ressource StorageAccount.

**Solution :** Passage de la variable à true.

---

### Sécurité & Performances

### 9. WAF Rate Limit avec groupByUserSession

**Problème :** Les règles de rate limiting du WAF ne peuvent pas être précisément groupées par session utilisateur car WAF n'a pas accès aux sessions express-session.

**Cause :** Le WAF opère en couche 7 mais n'a pas accès aux variables de session backend.

**Solution :** Utilisation de `groupByUserSession` basé sur ClientAddr (IP source) et optionnellement un header personnalisé pour les utilisateurs authentifiés. Rate limit configuré à 100 req/min par IP.

**Code Bicep :**
```bicep
groupByUserSession: [
  { groupByVariables: [ { variableName: 'ClientAddr' } ] }
]
```

---

### 10. Azure Front Door bloqué sur subscription étudiante

**Problème :** Azure Front Door Standard est refusé lors du déploiement sur subscription étudiante.

**Cause :** Les subscriptions étudiantes Azure Student n'accèdent pas à Front Door.

**Solution :** Module `frontdoor.bicep` créé mais désactivé par défaut (`enableFrontDoor=false` dans parameters). Prêt à activer sur une subscription production.

---

### 11. Restriction d'accès Backend cassant les appels Frontend

**Problème :** Après ajout des `ipSecurityRestrictions` sur le Backend App Service, le Frontend ne pouvait plus appeler les APIs.

**Cause :** Le Frontend était considéré comme trafic externe non autorisé.

**Solution :** Implémentation d'un **reverse proxy** sur le Frontend (via `server.cjs` en production) qui route `/api/*` vers le Backend en tant que connexion intra-VNet. Le Backend accepte les requêtes depuis le subnet App Gateway + AzureCloud service tag uniquement.

**Frontend reverse proxy :**
```javascript
app.use('/api', createProxyMiddleware({
  target: process.env.BACKEND_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  secure: true
}));
```

**Backend ipSecurityRestrictions :**
```bicep
[
  {
    vnetSubnetResourceId: '<appgwSubnetId>'
    action: 'Allow'
    priority: 100
    name: 'AllowAppGatewaySubnet'
  }
  {
    action: 'Allow'
    priority: 110
    name: 'AllowAzureCloud'
    serviceTag: 'AzureCloud'
  }
  {
    action: 'Deny'
    priority: 200
    name: 'DenyAllInternet'
    ipAddress: '0.0.0.0/0'
  }
]
```

---

### 12. OAuth redirect_uri_mismatch

**Problème :** Google OAuth retournait `redirect_uri_mismatch` - l'URI de callback configuré dans Google Cloud ne correspondait pas à celui de la requête.

**Cause :** Confusion entre `BASE_URL` (backend) et `FRONTEND_URL` (frontend). Le callback devait pointer vers le Frontend proxy, pas le Backend direct.

**Solution :** Clarification de la configuration OAuth :
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : Du Google Cloud Console
- `BASE_URL` : URL du backend (ex: `https://app-...-backend-dev.azurewebsites.net`) - utilisée pour API calls
- `FRONTEND_URL` : URL du frontend (ex: `https://app-...-frontend-dev.azurewebsites.net`) - utilisée pour redirects post-login
- Callback URL dans Google Cloud : `https://app-...-frontend-dev.azurewebsites.net/api/auth/google/callback`

**Code Backend :**
```typescript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
  passReqToCallback: true
}, ...))
```

---

### 13. Cold start 2 minutes sur App Service Linux

**Problème :** Premier appel à l'application prenait 2+ minutes après inactivité.

**Cause :** Sans "Always On" activé, Azure met en hibernation les instances inactives.

**Solution :** Activation de la propriété `alwaysOn: true` sur les App Services (à partir du tier Standard S1, non disponible en Basic).

**Bicep :**
```bicep
siteConfig: {
  alwaysOn: true
  ...
}
```

---

### 14. new URL() crash avec VITE_API_URL relative

**Problème :** Code frontend utilisant `new URL(relativeUrl, VITE_API_URL)` crash en build Vite.

**Cause :** `VITE_API_URL` était défini sans protocole/domaine, causant une exception URL invalide.

**Solution :** Toujours configurer `VITE_API_URL` avec le domaine complet en production (ex: `https://app-...-frontend-dev.azurewebsites.net/api`) ou utiliser des URL absolues avec fallback :

```typescript
const apiUrl = new URL(
  endpoint,
  VITE_API_URL || `${window.location.origin}/api`
).toString();
```

---

## Estimation des coûts

### Environnement de développement avec sécurité (mensuel)

| Service | SKU | Coût estimé | Notes |
|---------|-----|-------------|-------|
| **App Service Plan** | S1 (Standard) | ~55 € | Supporte autoscale (1-3 instances) |
| **App Service Plan (burst x3)** | S1 x3 | ~165 € | Coût max sous charge |
| **PostgreSQL Flexible Server** | Burstable B1ms | ~15 € | 1 vCore, 2 GB RAM |
| **Storage Account** | Standard LRS | ~1 € | < 10 GB estimé |
| **Application Gateway** | WAF_v2 | ~250-330 € | Coût fixe horaire + traitement trafic |
| **Key Vault** | Standard | ~0.03 € | ~5 secrets |
| **App Configuration** | Free | 0 € | < 1000 requêtes/jour |
| **Function App** | Consumption | ~0 € | < 1M exécutions |
| **Public IP** | Standard Static | ~4 € | Pour Application Gateway |
| **Bande passante** | - | ~1 € | Sortie < 5 GB |
| **Total idle (1 instance)** | | **~325-400 €/mois** | Sans autoscale burst |
| **Total burst (3 instances)** | | **~435-510 €/mois** | Avec 3 instances actives |

**Justification des choix :**

**Pourquoi S1 au lieu de B1 ?**

| Critère | B1 (Basic) | S1 (Standard) |
|---------|-----------|---|
| **Prix/mois** | ~13€ | ~55€ |
| **Autoscale** | ❌ Non supporté | ✅ Oui (1-3 instances) |
| **Slots de déploiement** | ❌ Non | ✅ Oui |
| **VNet integration** | ❌ Non | ✅ Oui |
| **Coût max (3 instances)** | N/A | ~165€ |
| **Always On** | ❌ Non | ✅ Oui |

**Pourquoi Application Gateway plutôt que Load Balancer ?**
- **Layer 7 vs Layer 4:** App Gateway opère en couche HTTP/HTTPS (7) vs Load Balancer en TCP/UDP (4)
- **WAF natif:** App Gateway intègre nativement le Web Application Firewall
- **Routage avancé:** Basé sur URL, affinité de session, SSL termination
- **Load Balancer limitation:** Ne fournit pas de protection WAF, routage basique seulement

**Pourquoi WAF_v2 ?**
- **Seul tier WAF:** WAF_v2 est le seul SKU supportant le Web Application Firewall
- **Rulesets:** Protection OWASP 3.2 contre SQL injection, XSS, CSRF, etc.
- **Custom rules:** Rate limiting, geo-filtering, blocklists personnalisées
- **Mode prevention:** Bloque les attaques (vs Detection qui log seulement)

### Projection environnement production

| Service | SKU Production | Coût estimé | Notes |
|---------|----------------|-------------|-------|
| **App Service Plan** | S2 (Standard) | ~110 € | Supporte autoscale 1-5 instances |
| **PostgreSQL** | General Purpose D2s | ~120 € | Production-grade HA |
| **Storage Account** | Standard GRS | ~5 € | Redondance géographique |
| **Application Gateway** | WAF_v2 | ~330-500 € | 2+ instances, trafic élevé |
| **Function App** | Premium EP1 | ~150 € | Always-on, performance |
| **Front Door** | Standard | ~130 € | Multi-région failover |
| **Azure Monitor** | Standard | ~50 € | Alertes + Dashboard |
| **Bande passante** | - | ~50 € | Sortie 100+ GB |
| **Total Production** | | **~945-1250 €/mois** | HA multi-région |

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

**MORIN Enzo** ([@Zowx](https://github.com/Zowx)) <br/>
**PEREIRA Matteo** ([@Aairuxul](https://github.com/Aairuxul)) <br/>
**RUSSEIL Valentin** ([@ValentinRusseil](https://github.com/ValentinRusseil))

---

## Licence

Ce projet est à usage éducatif uniquement.
