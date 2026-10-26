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

Un super-admin peut aussi **ouvrir la console d'une entreprise** (bouton « Ouvrir » dans **Entreprises**)
pour l'assister : il y dispose de tous les droits, un bandeau « Mode OmniCom » le rappelle, et chacune de
ses actions apparaît dans le journal de l'entreprise avec la mention « (OmniCom) ». « Revenir à la
plateforme » le ramène à la console OmniCom. Côté API, c'est l'en-tête `X-Company-Id`, accepté uniquement
pour les super-admins.

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
| **Modèle de facture** | Modèle standard, ou **import du modèle de l'entreprise** (PDF, PNG, JPEG ; A4 ou A5) adapté dans un éditeur visuel |

## Pensé pour être simple

- **Créer un document en 3 étapes** : type et client → articles (catalogue en un clic, quantités avec − / +, article libre avec Entrée) → enregistrer. Les réglages rares (remise, numéro, taux, format, notes) sont repliés dans « Plus d'options ».
- **Après l'enregistrement** : imprimer, **envoyer par WhatsApp** (message prêt avec le montant et le reste à payer, au numéro de la fiche client), encaisser en un clic, ou **refaire un document identique**.
- **Recherche rapide** (`Ctrl + K` ou « Rechercher… ») : une page, un client ou un numéro de facture.
- **Sur téléphone** : barre de navigation en bas avec un gros bouton « + » pour créer un document.
- Tableau de bord avec actions rapides et guide « Bien démarrer », thème clair ou sombre, confirmations claires.

## Importer son propre modèle de facture

Dans **Modèle de facture** (permission « Paramètres et personnalisation ») :

1. **Importer** une page vierge de son modèle : PDF (1re page convertie dans le navigateur), PNG ou JPEG.
   En-tête, pied de page, filigrane et coordonnées restent tels quels ; le format A4/A5 est détecté.
2. **Placer les zones** à la souris sur l'aperçu (déplacer, redimensionner par le coin) ou au pourcentage près :
   numéro et dates, client, tableau des articles, totaux, montant en lettres, notes, cachet PAYÉ/ANNULÉ.
   Chaque zone peut être masquée et alignée.
3. **Adapter** la police, la taille du texte, les couleurs du tableau et tous les libellés
   (ex. « FACTURE D'ACHAT N° », « P.U »).

Le rendu est **adaptatif** : chaque zone réduit automatiquement sa taille de texte pour que tout son contenu
tienne (un tableau de 25 lignes reste lisible en A5). Si une zone ne peut vraiment pas tout contenir,
un avertissement s'affiche dans l'éditeur et sur la facture. Le modèle s'applique à toutes les factures
et proformas, réimpressions comprises ; on peut revenir au modèle standard à tout moment sans perdre
le modèle importé.

## Installation

```bash
docker compose up -d mongodb          # ou MongoDB Atlas

cd server
cp .env.example .env                  # MONGODB_URI, OMNICOM_ADMIN_PASSWORD
npm install && npm run dev            # http://localhost:5000

# autre terminal, dans ProformatWeb/
npm install && npm run dev            # http://localhost:5173
```

1. Définissez `OMNICOM_ADMIN_PASSWORD` : au premier démarrage, le compte administrateur OmniCom est créé
   automatiquement et vous vous connectez directement (ou utilisez l'écran **Installation** avec `SETUP_KEY`).
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
| `MONGODB_URI` | ✅ | Chaîne de connexion MongoDB (Atlas : autoriser `0.0.0.0/0` dans Network Access pour Vercel) |
| `OMNICOM_ADMIN_PASSWORD` | ✅ au premier démarrage | Crée automatiquement le compte administrateur OmniCom (8 caractères minimum). Jamais écrasé ensuite : changez le mot de passe dans l'application |
| `OMNICOM_ADMIN_EMAIL` | | E-mail de ce compte (défaut `mpunantitarubain@gmail.com`) ; un ancien compte portant cet e-mail devient le compte OmniCom |
| `JWT_SECRET` | | Secret des sessions ; s'il est absent, il est dérivé de `MONGODB_URI` |
| `SETUP_KEY` | | Alternative : écran « Installation » pour créer le premier compte OmniCom |
| `JWT_EXPIRES_IN` | | Durée d'une session (défaut `12h`) |
| `CORS_ORIGIN` | | Origines autorisées, séparées par des virgules |

`GET /api/health` indique les variables manquantes (noms uniquement) ; l'écran de connexion affiche
le réglage à compléter.

Sur Vercel : **Project → Settings → Environment Variables** (jamais dans un fichier commité).

## Tests

```bash
npm --prefix server test                                                             # MongoDB en mémoire
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/proformat_test npm --prefix server test   # base locale
npm run lint && npm run build                                                        # frontend
```

Couverture : installation protégée, création d'entreprise réservée à OmniCom, rôles sur mesure et
permissions, blocage et suspension, personnalisation (logo, couleurs), modèle importé (validation, droits, isolation), 2FA, cycle de facturation
complet, isolation entre entreprises et migration des anciennes données.
