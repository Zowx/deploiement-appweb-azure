# PLAN - Application Web 3-Tiers Azure

## Résumé du Projet

Développer et déployer une application web complète suivant une architecture 3-tiers sur Microsoft Azure.

---

## 1. Choix Techniques

### Frontend
- **Technologie** : React (Vite)
- **Justification** : Écosystème mature, performance, facilité de déploiement sur Azure App Service

### Backend
- **Technologie** : Node.js (Express + TypeScript)
- **Justification** : Même langage que le frontend, écosystème unifié, typage avec TypeScript

### Base de données
- **Service Azure** : Azure Database for PostgreSQL (Flexible Server)
- **Justification** : Coût maîtrisé, familiarité avec PostgreSQL, bonnes performances

### Modèle de déploiement
- **Choix** : PaaS - Azure App Service
- **Justification** : Simplicité de gestion, scaling automatique, intégration native CI/CD

---

## 2. Architecture Azure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Resource Group                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Frontend   │    │   Backend    │    │   PostgreSQL     │  │
│  │  App Service │───▶│  App Service │───▶│  Flexible Server │  │
│  │   (React)    │    │  (FastAPI)   │    │                  │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Key Vault   │    │ Blob Storage │    │ App Configuration│  │
│  │  (Secrets)   │    │  (Fichiers)  │    │   (Settings)     │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                 │
│  ┌──────────────┐ (Optionnel)                                  │
│  │Azure Function│                                               │
│  │  (Logging)   │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Structure du Repository

```
cloud-azure/
├── PLAN.md
├── README.md
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── models/
│   │   └── services/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── infra/
│   ├── main.bicep
│   ├── modules/
│   │   ├── appservice.bicep
│   │   ├── database.bicep
│   │   ├── storage.bicep
│   │   ├── keyvault.bicep
│   │   └── appconfig.bicep
│   └── parameters/
│       ├── dev.bicepparam
│       └── prod.bicepparam
├── functions/
│   └── logging/
│       ├── index.ts
│       └── function.json
└── .github/
    └── workflows/
        ├── deploy-infra.yml
        ├── deploy-backend.yml
        └── deploy-frontend.yml
```

---

## 4. Phases de Développement

### Phase 1 : Infrastructure Bicep (Priorité Haute)
- [ ] Créer le module `appservice.bicep` (App Service Plan + 2 Web Apps)
- [ ] Créer le module `database.bicep` (PostgreSQL Flexible Server)
- [ ] Créer le module `storage.bicep` (Storage Account + Container Blob)
- [ ] Créer le module `keyvault.bicep` (Key Vault + secrets)
- [ ] Créer le module `appconfig.bicep` (App Configuration)
- [ ] Assembler `main.bicep` avec tous les modules
- [ ] Configurer les Managed Identities pour les connexions sécurisées

### Phase 2 : Backend Express/TypeScript
- [ ] Setup projet Express avec TypeScript
- [ ] Implémenter les modèles de données (Prisma ORM)
- [ ] Créer les endpoints CRUD de base
- [ ] Implémenter l'upload de fichiers vers Blob Storage (@azure/storage-blob)
- [ ] Intégrer Azure Key Vault pour les secrets (@azure/keyvault-secrets)
- [ ] Intégrer Azure App Configuration (@azure/app-configuration)
- [ ] Tests unitaires (Jest)

### Phase 3 : Frontend React
- [ ] Setup projet React avec Vite
- [ ] Créer les composants UI principaux
- [ ] Implémenter l'interface d'upload de fichiers
- [ ] Connexion à l'API backend
- [ ] Gestion des erreurs et états de chargement

### Phase 4 : CI/CD GitHub Actions
- [ ] Workflow de déploiement infrastructure Bicep
- [ ] Workflow de build et déploiement backend
- [ ] Workflow de build et déploiement frontend
- [ ] Configuration des secrets GitHub (Azure credentials)

### Phase 5 : Azure Function - Logging (Optionnel)
- [ ] Créer la Function App en TypeScript
- [ ] Implémenter le trigger pour les logs d'activité
- [ ] Implémenter la capture des erreurs critiques
- [ ] Stockage des logs dans Table Storage ou Blob

---

## 5. Services Azure Requis

| Service | SKU/Tier | Usage |
|---------|----------|-------|
| App Service Plan | B1 (Basic) | Hébergement Frontend + Backend |
| Web App x2 | - | Frontend React, Backend FastAPI |
| PostgreSQL Flexible | Burstable B1ms | Base de données |
| Storage Account | Standard LRS | Blob Storage |
| Key Vault | Standard | Secrets |
| App Configuration | Free | Configuration centralisée |
| Function App (opt.) | Consumption | Logging |

---

## 6. Estimation des Coûts (Mensuel)

| Service | Coût estimé |
|---------|-------------|
| App Service Plan B1 | ~13€ |
| PostgreSQL B1ms | ~15€ |
| Storage Account | ~1€ |
| Key Vault | ~0.03€/secret |
| App Configuration | Gratuit (tier Free) |
| Function App | ~0€ (Consumption) |
| **Total estimé** | **~30€/mois** |

---

## 7. Livrables

- [ ] Code source complet (frontend + backend + functions)
- [ ] Templates Bicep modulaires
- [ ] Workflows CI/CD GitHub Actions
- [ ] Application déployée et fonctionnelle
- [ ] Documentation technique (README)
- [ ] Rapport technique (choix, architecture, difficultés, coûts)

---

## 8. Accès Repository

Donner accès à : **guilian.ganster@gmail.com** (GitHub: @gganster)

---

## 9. Prochaines Actions

1. **Initialiser le repository Git**
2. **Créer la structure de dossiers**
3. **Commencer par l'infrastructure Bicep** (fondation du projet)
4. **Développer le backend** avec l'endpoint d'upload
5. **Développer le frontend** avec l'interface utilisateur
6. **Configurer les pipelines CI/CD**
7. **Tester le déploiement complet**
8. **Rédiger le rapport technique**
