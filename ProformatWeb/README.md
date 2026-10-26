# OmniCom Facturation

Plateforme de facturation multi-entreprise éditée par **OmniCom**. Chaque entreprise cliente dispose
d'un espace isolé pour émettre ses **proformas** et **factures** à son logo et à ses couleurs, suivre
ses encaissements, ses clients, son stock et ses dépenses.

- **Frontend** : React 19 + TypeScript + Vite (`src/`)
- **API** : Express 5 + MongoDB/Mongoose (`server/`), déployable sur Vercel ou en Node classique

## Qui fait quoi

| Niveau | Qui | Peut |
|---|---|---|
| **Plateforme** | Équipe OmniCom (super-admins) | Créer les entreprises et leur administrateur, personnaliser leur profil, suspendre / réactiver un compte, réinitialiser un mot de passe, ajouter d'autres super-admins. N'accède pas aux données de facturation des entreprises. |
| **Entreprise** | Administrateur de l'entreprise | Tout dans son entreprise : logo et couleurs des factures, coordonnées, **création de rôles sur mesure**, utilisateurs. |
| **Entreprise** | Utilisateurs | Ce que leur rôle autorise (cases à cocher par permission). |

Seul OmniCom peut créer un compte entreprise : il n'y a pas d'inscription publique.

### Rôles et permissions

Chaque entreprise reçoit trois rôles de départ : **Administrateur** (verrouillé, accès complet),
**Gestionnaire** et **Employé**. L'administrateur peut les modifier ou créer les siens (ex. Caissier,
Magasinier) en combinant les permissions :

| Domaine | Permissions |
|---|---|
| Ventes | créer/modifier factures et proformas · annuler des factures · enregistrer / supprimer des encaissements · gérer / supprimer des clients |
| Opérations | gérer le catalogue · mouvements de stock · dépenses |
| Pilotage | rapports et résultats financiers · journal d'activité |
| Administration | utilisateurs · rôles · paramètres et personnalisation |

Tout utilisateur peut consulter les factures, clients et produits de son entreprise. Les droits sont
relus à chaque requête : un changement de rôle, un blocage ou la suspension d'une entreprise
prend effet immédiatement.

### Isolation des données

Chaque document (client, produit, facture, paiement, dépense, mouvement de stock, journal) porte
l'identifiant de son entreprise et toutes les requêtes de l'API sont filtrées dessus. La numérotation
(`FAC-2026-0001`, `PRO-2026-0001`) est propre à chaque entreprise. Les tests automatisés vérifient
qu'une entreprise ne peut ni lire ni modifier les données d'une autre.

## Modules d'une entreprise

| Module | Fonctionnalités |
|---|---|
| **Tableau de bord** | CA facturé et encaissé, créances et retards, résultat, graphique sur 12 mois, alertes de stock |
| **Factures & proformas** | Modèle imprimable A4/A5/A6 au logo, aux couleurs et aux coordonnées de l'entreprise, remise, échéance, conversion proforma → facture, annulation, export CSV |
| **Encaissements** | Paiements partiels ou totaux, statut automatique, journal exportable |
| **Clients** | Fiches, solde dû par devise, historique |
| **Produits & stock** | Catalogue USD/FC, prix sur devis, stock décrémenté à la facturation, mouvements, seuils d'alerte |
| **Dépenses & rapports** | Dépenses par catégorie, rapports consolidés au taux de change de l'entreprise |
| **Entreprise & logo** | Logo, bandeau de bas de page, trois couleurs, coordonnées légales et bancaires, taux de change |

## Installation

```bash
docker compose up -d mongodb          # ou MongoDB Atlas

cd server
cp .env.example .env                  # MONGODB_URI, JWT_SECRET, SETUP_KEY
npm install && npm run dev            # http://localhost:5000

# autre terminal, dans ProformatWeb/
npm install && npm run dev            # http://localhost:5173
```

1. Ouvrez l'application : l'écran **Installation** demande la clé `SETUP_KEY` et crée le premier
   super-admin OmniCom (une seule fois).
2. Dans **Entreprises**, créez chaque entreprise avec son logo et son administrateur.
3. L'administrateur se connecte, ajuste ses rôles et crée ses utilisateurs.

### Reprise des données existantes

Les données de la version précédente (mono-entreprise) sont rattachées automatiquement à l'entreprise
**Mélanine Print**, créée avec son logo, ses coordonnées et ses rôles ; les anciens comptes gardent leur
niveau (admin → Administrateur, gestionnaire → Gestionnaire, employé → Employé). Migration idempotente,
aussi disponible via `npm --prefix server run migrate`.

## Variables d'environnement (API)

| Variable | Obligatoire | Description |
|---|:-:|---|
| `MONGODB_URI` | ✅ | Chaîne de connexion MongoDB |
| `JWT_SECRET` | ✅ | Secret de signature des sessions (32 caractères aléatoires ou plus) |
| `SETUP_KEY` | ✅ à l'installation | Clé exigée pour créer le premier super-admin OmniCom ; peut être retirée ensuite |
| `JWT_EXPIRES_IN` | | Durée d'une session (défaut `12h`) |
| `CORS_ORIGIN` | | Origines autorisées, séparées par des virgules |

Sur Vercel : **Project → Settings → Environment Variables** (jamais dans un fichier commité).

## Tests

```bash
npm --prefix server test                                                             # MongoDB en mémoire
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/proformat_test npm --prefix server test   # base locale
npm run lint && npm run build                                                        # frontend
```

Couverture : installation protégée, création d'entreprise réservée à OmniCom, rôles sur mesure et
permissions, blocage et suspension, personnalisation (logo, couleurs), 2FA, cycle de facturation
complet, isolation entre entreprises et migration des anciennes données.
