# Cloud Azure - Application Web 3-Tiers

Application web complète déployée sur Microsoft Azure avec architecture 3-tiers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Resource Group                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Frontend   │    │   Backend    │    │   PostgreSQL     │  │
│  │  App Service │───▶│  App Service │───▶│  Flexible Server │  │
│  │   (React)    │    │  (Express)   │    │                  │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
│                             │                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Key Vault   │    │ Blob Storage │    │ App Configuration│  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Stack Technique

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript + Prisma
- **Base de données**: Azure PostgreSQL Flexible Server
- **Stockage**: Azure Blob Storage
- **Secrets**: Azure Key Vault
- **Configuration**: Azure App Configuration
- **Infrastructure**: Bicep (IaC)
- **CI/CD**: GitHub Actions

## Structure du Projet

```
cloud-azure/
├── frontend/          # Application React
├── backend/           # API Express
├── infra/             # Templates Bicep
│   ├── main.bicep
│   ├── modules/
│   └── parameters/
└── .github/workflows/ # Pipelines CI/CD
```

## Démarrage Local

### Avec Docker (Recommandé)

La méthode la plus simple pour lancer l'application en local :

```bash
# Mode développement (avec hot reload)
make dev

# Voir les logs
make dev-logs

# Arrêter
make dev-stop
```

**URLs en mode développement :**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

```bash
# Mode production (containers buildés)
make prod

# Avec Nginx reverse proxy (tout sur le port 8080)
make prod-nginx
```

**URLs en mode production :**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- App (via Nginx): http://localhost:8080

**Autres commandes utiles :**
```bash
make help      # Voir toutes les commandes disponibles
make clean     # Supprimer tous les containers et volumes
make db-reset  # Réinitialiser la base de données
make db-shell  # Ouvrir un shell PostgreSQL
```

### Sans Docker

#### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Déploiement

### 1. Configurer les secrets GitHub

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `DB_ADMIN_PASSWORD`

### 2. Déployer l'infrastructure

```bash
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters dbAdminPassword=<PASSWORD>
```

### 3. Push sur main

Les workflows GitHub Actions déploient automatiquement :
- Infrastructure (quand `infra/**` change)
- Backend (quand `backend/**` change)
- Frontend (quand `frontend/**` change)

## Variables d'Environnement Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL |
| `AZURE_STORAGE_ACCOUNT_NAME` | Nom du Storage Account |
| `AZURE_STORAGE_CONTAINER_NAME` | Nom du container blob |
| `AZURE_KEYVAULT_NAME` | Nom du Key Vault |
| `AZURE_APPCONFIG_ENDPOINT` | Endpoint App Configuration |

## Fonctionnalités

- Upload de fichiers vers Blob Storage
- Liste et suppression des fichiers
- Stockage des métadonnées en PostgreSQL
- Authentification via Managed Identity
