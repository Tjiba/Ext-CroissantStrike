# CroissantStrike — Extension Chrome

Extension Chrome pour suivre **CroissantStrike** (streamer CS2 pro français) : statut live, matchs en cours sur la scène mondiale, et résultats récents.

---

## Ce que fait l'extension

- Badge **EN DIRECT / REDIFFUSION / HORS-LIGNE** sur l'icône
- Miniature du stream avec durée et nombre de viewers
- Match en cours : équipes, scores par map, map actuelle
- Matchs pro en cours sur la scène mondiale (PandaScore)
- 10 derniers résultats avec scores, logos, veto et détail des maps
- Liens vers Twitch, YouTube, réseaux sociaux, hub Faceit et shop

---

## Installation

1. Aller sur `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `ExtCS/`

Après une modification de fichier, cliquer ↺ sur la carte de l'extension pour recharger.

---

## Structure des fichiers

```
ExtCS/
├── manifest.json        # Config Chrome MV3 (permissions, popup, service worker)
├── background.js        # Tourne en arrière-plan : polls API toutes les minutes
│
├── popup/
│   ├── popup.html       # Interface de la popup (3 tabs : Live, Résultats, Liens)
│   ├── popup.js         # Logique d'affichage
│   └── popup.css        # Styles (thème sombre)
│
├── utils/
│   ├── twitch.js        # Récupère le statut du stream via le Worker
│   ├── csapi.js         # Récupère le détail du match en cours (csapi.de)
│   └── match.js         # Associe le titre du stream à un match csapi
│
├── worker/
│   ├── index.js         # Cloudflare Worker : proxy Twitch + PandaScore
│   └── wrangler.toml    # Config de déploiement
│
└── icons/               # Icônes de l'extension
```

---

## Comment ça fonctionne

```
background.js  (toutes les minutes)
    │
    ├── Worker Cloudflare (patient-wave-e2d7.tjiba.workers.dev)
    │       ├── Twitch API  → statut live, viewers, thumbnail
    │       └── PandaScore  → matchs pro en cours + logos équipes
    │
    ├── api.tjiba.fr/extension → 10 derniers résultats (HLTV)
    └── api.tjiba.fr/logo      → logos en couleur par nom d'équipe
    
    → Stocke tout dans chrome.storage.local
    
popup.js  (à l'ouverture)
    → Lit le storage et affiche immédiatement
    → Déclenche un poll pour rafraîchir les données
```

---

## APIs utilisées

| API | Rôle |
|-----|------|
| `patient-wave-e2d7.tjiba.workers.dev` | Statut Twitch + matchs live PandaScore |
| `api.tjiba.fr/extension?limit=10` | 10 derniers résultats HLTV |
| `api.tjiba.fr/logo?teams=X,Y` | Logos équipes en couleur (PNG base64) |
| `api.csapi.de` | Détail du match en cours (scores par map) |

Les appels à `api.tjiba.fr` nécessitent le header `x-secret: Extcs3`.

---

## Déployer le Worker Cloudflare

Le Worker gère les credentials Twitch et PandaScore pour ne pas les exposer dans l'extension.

```bash
cd worker
npx wrangler deploy
```

Variables à configurer dans le Dashboard Cloudflare (Worker → Settings → Variables) :

| Variable | Description |
|----------|-------------|
| `TWITCH_CLIENT_ID` | Client ID de l'app Twitch |
| `TWITCH_CLIENT_SECRET` | Secret de l'app Twitch |
| `PANDASCORE_TOKEN` | Token Bearer PandaScore |
