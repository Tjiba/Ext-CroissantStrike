# CroissantStrike — Extension Chrome

Extension Chrome (MV3) pour suivre **CroissantStrike** (streamer CS2 pro français) :
statut live du stream, matchs pro de la scène mondiale, résultats récents, et événements CS2 —
avec l'**arbre suisse** et le **bracket playoffs** du Major en cours.

---

## Ce que fait l'extension

**Onglet Live**
- Badge **EN DIRECT / REDIFFUSION / HORS-LIGNE** sur l'icône
- Miniature du stream avec durée et nombre de viewers
- Match en cours du streamer : équipes, scores, format (BO)
- Matchs pro en cours sur la scène mondiale (scrapés HLTV)
- Matchs notables du jour à venir

**Onglet Résultats**
- 10 derniers résultats : scores, logos, et détail dépliable (maps, veto, stage)

**Onglet Events**
- Événements CS2 du mois (statut, dates, logos)
- Clic sur un **stage du Major en cours** → déplie l'**arbre suisse** (Swiss bracket façon HLTV) :
  colonnes par bilan V-D (`0-0` → `2-1`…) qui se rétrécissent, score de maps, vainqueur,
  zones **Qualifiés** (vert) / **Éliminés** (rouge)
- Clic sur le **Major** (ligne parente) → déplie le **bracket Playoffs** (quarts → demis → finale)
- La popup s'élargit automatiquement pour afficher l'arbre, puis revient à sa taille

**Liens** : Twitch, YouTube, réseaux sociaux, hub Faceit, shop

---

## Installation

1. Aller sur `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le **dossier du projet** (celui qui contient `manifest.json`)

Après une modif : rouvrir la popup suffit pour `popup/*` ; cliquer ↺ sur la carte de
l'extension pour un changement de `background.js` ou `manifest.json`.

---

## Structure des fichiers

```
manifest.json          # Config Chrome MV3 (permissions, popup, service worker)
background.js          # Service worker : poll l'API chaque minute + fetch à la demande
│
popup/
├── popup.html         # Interface (3 onglets : Live, Résultats, Events)
├── popup.js           # Rendu + interactions (arbre suisse, bracket, dépliage)
└── popup.css          # Styles (thème sombre)
│
utils/
├── twitch.js          # Statut du stream (/stream) + matchs live (/matches/live)
├── swiss.js           # Logique pure de l'arbre suisse (détection, colonnes, zones, scores)
└── swiss.test.js      # Tests unitaires (node:test, sans dépendance)
│
icons/                 # Icônes de l'extension
```

---

## Comment ça fonctionne

```
background.js
│
├── Poll (toutes les minutes) ─────────────→ chrome.storage.local
│     ├── /stream             → statut live Twitch
│     ├── /matches/live       → matchs pro en cours
│     ├── /matches/upcoming   → matchs notables du jour
│     ├── /matches/results    → 10 derniers résultats
│     └── /events             → événements CS2 du mois
│
└── À la demande (messages depuis la popup)
      ├── /major/stages        → arbre suisse du Major (chargé à l'ouverture de la popup)
      └── /events/{id}/bracket → bracket playoffs (chargé au clic sur le Major)

popup.js (à l'ouverture)
└── Lit le storage, affiche immédiatement, déclenche un refresh.
    Logos d'équipes et d'events servis par api.tjiba.fr.
```

---

## APIs utilisées

Tout vient de **`api.tjiba.fr`** (la CS2 API de Tjiba — données scrapées de HLTV).
Endpoints publics, réponses JSON, aucun header requis.

| Endpoint | Rôle |
|----------|------|
| `GET /stream` | Statut live Twitch (titre, viewers, démarrage) |
| `GET /matches/live` | Matchs pro en cours |
| `GET /matches/upcoming` | Matchs notables du jour à venir (avec logos) |
| `GET /matches/results` | 10 derniers résultats : scores, maps, veto, stage, logos |
| `GET /events` | Événements CS2 du mois |
| `GET /major/stages` | Stages suisses du Major en cours (Stage 1/2/3 + leurs matchs) |
| `GET /events/{id}/bracket` | Bracket playoffs d'un événement |
| `GET /logos/{équipe}.png` | Logo d'une équipe |

Doc complète des endpoints sur https://api.tjiba.fr.

---

## Tests

La logique pure de l'arbre suisse (`utils/swiss.js`) est couverte par des tests sans dépendance
(runner intégré de Node, aucun `npm install`) :

```bash
node --test utils/swiss.test.js
```
