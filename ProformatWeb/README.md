# Mélanine Print — ERP de gestion commerciale

Application web de gestion pour l'imprimerie Mélanine Print : facturation, clients, stock,
encaissements, dépenses et rapports, avec gestion d'équipe et traçabilité.

- **Frontend** : React 19 + TypeScript + Vite (`src/`)
- **API** : Express 5 + MongoDB/Mongoose (`server/`), déployable sur Vercel ou en Node classique

## Modules

| Module | Fonctionnalités |
|---|---|
| **Tableau de bord** | CA facturé et encaissé du mois, créances et retards, résultat, graphique sur 12 mois, alertes de stock |
| **Factures & proformas** | Numérotation automatique par année (`FAC-2026-0001`, `PRO-2026-0001`), remise, échéance, notes, impression A4/A5/A6 au gabarit maison, conversion proforma → facture, annulation avec motif, recherche et filtres, export CSV |
| **Encaissements** | Paiements partiels ou totaux (espèces, Mobile Money, virement…), statut automatique (En attente → Partiellement payée → Payée), journal exportable |
| **Clients** | Fiches clients (contact, n° impôt…), solde dû par devise, historique des documents ; création automatique lors de la facturation |
| **Produits & stock** | Catalogue par catégorie, prix numérique en USD ou FC, prix « sur devis », suivi de stock optionnel : sortie automatique à la facturation, retour à l'annulation, entrées / sorties / inventaire manuels, seuils d'alerte, historique des mouvements, import de la grille tarifaire 2026 |
| **Dépenses** | Saisie par catégorie et fournisseur, totaux par devise, export CSV |
| **Rapports** | Période libre, montants consolidés dans la devise de reporting au taux paramétré, meilleurs clients et produits, évolution mensuelle |
| **Équipe** | Comptes nominatifs, rôles, blocage immédiat, réinitialisation du mot de passe et de la 2FA |
| **Sécurité** | Connexion par e-mail et mot de passe (bcrypt), sessions JWT, double authentification TOTP, limitation des tentatives, journal d'activité côté serveur |
| **Paramètres** | Coordonnées imprimées sur les factures, taux de change, devise des rapports, délai de paiement |

### Rôles

| Action | Employé | Gestionnaire | Administrateur |
|---|:-:|:-:|:-:|
| Créer factures/proformas, encaisser, gérer les clients | ✅ | ✅ | ✅ |
| Gérer le catalogue et le stock, annuler une facture, supprimer un paiement | | ✅ | ✅ |
| Dépenses, rapports, journal d'activité | | ✅ | ✅ |
| Équipe et paramètres | | | ✅ |

> Une facture émise n'est plus modifiable : pour la corriger, annulez-la (après suppression
> des paiements éventuels) puis créez-en une nouvelle. Les proformas restent modifiables
> jusqu'à leur conversion.

## Démarrage local

```bash
# 1. Base de données (ou utilisez MongoDB Atlas)
docker compose up -d mongodb

# 2. API
cd server
cp .env.example .env     # puis renseignez MONGODB_URI et JWT_SECRET
npm install
npm run dev              # http://localhost:5000

# 3. Frontend (dans un autre terminal, à la racine de ProformatWeb)
npm install
npm run dev              # http://localhost:5173
```

Au premier lancement, l'écran de connexion propose de **créer le compte administrateur**.
Si un utilisateur existe déjà avec cet e-mail (ancienne version), il est promu administrateur.
L'administrateur crée ensuite les comptes de l'équipe depuis **Équipe**.

## Reprise des données de l'ancienne version

Les produits et factures enregistrés avec l'ancienne version (prix et totaux en texte comme
`"300 FC"`) sont convertis automatiquement à la première requête de l'API : prix numériques,
dates, création des fiches clients et, pour les factures marquées « Payée », d'un encaissement.
La migration est idempotente ; elle peut aussi être lancée à la main : `npm --prefix server run migrate`.

## Variables d'environnement (API)

| Variable | Obligatoire | Description |
|---|:-:|---|
| `MONGODB_URI` | ✅ | Chaîne de connexion MongoDB |
| `JWT_SECRET` | ✅ | Secret de signature des sessions (32 caractères aléatoires ou plus) |
| `JWT_EXPIRES_IN` | | Durée d'une session (défaut `12h`) |
| `CORS_ORIGIN` | | Origines autorisées, séparées par des virgules |

Sur Vercel, définissez-les dans **Project → Settings → Environment Variables** (jamais dans
`vercel.json` ni dans un fichier commité).

## Tests

```bash
npm --prefix server test                                              # MongoDB en mémoire
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/proformat_test npm --prefix server test  # base locale
npm run lint && npm run build                                         # frontend
```

Les tests couvrent l'authentification (configuration initiale, rôles, blocage, 2FA), le cycle
complet d'une facture (stock, paiements, annulation), la conversion de proforma, les rapports
multi-devises et la migration des anciennes données.
