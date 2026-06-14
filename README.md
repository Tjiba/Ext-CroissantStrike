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
├── background.js        # Tourne en arrière-plan : poll l'API toutes les minutes
│
├── popup/
│   ├── popup.html       # Interface de la popup (3 tabs : Live, Résultats, Events)
│   ├── popup.js         # Logique d'affichage
│   └── popup.css        # Styles (thème sombre)
│
├── utils/
│   └── twitch.js        # Statut du stream (/stream) + matchs live (/matches/live)
│
└── icons/               # Icônes de l'extension
```

---

## Comment ça fonctionne

```
background.js  (toutes les minutes)
    │
    ├── api.tjiba.fr/stream            → statut live Twitch (titre, viewers, démarrage)
    ├── api.tjiba.fr/matches/live      → matchs pro en cours (scrapés HLTV)
    ├── api.tjiba.fr/matches/upcoming  → matchs notables du jour
    ├── api.tjiba.fr/matches/results   → 10 derniers résultats (scores, maps, veto)
    └── api.tjiba.fr/events            → événements CS2 du mois
    
    → Stocke tout dans chrome.storage.local
    
popup.js  (à l'ouverture)
    → Lit le storage et affiche immédiatement
    → Déclenche un poll pour rafraîchir les données
    (logos servis par api.tjiba.fr/logos/{équipe}.png)
```

---

## APIs utilisées

Tout vient de **`api.tjiba.fr`** (la CS2 API de Tjiba — données scrapées de HLTV). Endpoints publics, réponses JSON, aucun header requis.

| Endpoint | Rôle |
|----------|------|
| `GET /stream` | Statut live Twitch (titre, viewers, démarrage) |
| `GET /matches/live` | Matchs pro en cours (scrapés HLTV) |
| `GET /matches/upcoming` | Matchs notables du jour à venir (avec logos) |
| `GET /matches/results` | 10 derniers résultats : scores, maps, veto, stage, logos |
| `GET /events` | Événements CS2 du mois |
| `GET /logos/{équipe}.png` | Logo d'une équipe (servi depuis Cloudflare R2) |

La liste complète des endpoints (dont `/major/stages`, `/events/{id}/stages`, `/events/{id}/bracket`) est documentée sur la page d'accueil https://api.tjiba.fr.
