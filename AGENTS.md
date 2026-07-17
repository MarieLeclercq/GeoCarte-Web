# GeoCarte - Projet Complet

## Résumé du projet

Application de cartographie pédagogique interactive pour enseignants et élèves d'Histoire-Géographie.

## Deux versions créées

### 1. Version iOS (Xcode) - `GeoCarte/`
- Architecture MVVM professionnelle
- 32 fichiers Swift
- SwiftData + CloudKit
- Cible: iOS 17+ / iPadOS 17+

### 2. Version Web (Hors ligne) - `GeoCarte-Web/`
- PWA (Progressive Web App)
- Service Worker pour fonctionnement hors ligne
- Interface iOS-like
- Fonctionne sur iPad sans Xcode

## Structure du projet iOS

```
GeoCarte/
├── GeoCarte.xcodeproj/project.pbxproj
├── .gitignore
├── GeoCarte/
│   ├── App/
│   │   ├── GeoCarteApp.swift          # Point d'entrée
│   │   └── AppState.swift             # État global
│   ├── Models/
│   │   ├── User.swift                 # Utilisateur (élève/enseignant)
│   │   ├── MapProject.swift           # Projet de carte + 15 styles + 7 projections
│   │   ├── MapLayer.swift             # Calques + éléments dessin + 9 motifs
│   │   ├── TextElement.swift          # Textes
│   │   ├── Legend.swift               # Légende
│   │   └── Classroom.swift            # Classes, élèves, devoirs, versions
│   ├── Views/
│   │   ├── ContentView.swift
│   │   ├── SettingsView.swift
│   │   ├── Authentication/AuthView.swift
│   │   ├── Student/MapsListView.swift
│   │   ├── Student/MapLibraryView.swift
│   │   ├── Student/StudentWorkView.swift
│   │   ├── Teacher/ClassesListView.swift
│   │   ├── Teacher/ClassroomDetailView.swift
│   │   ├── Teacher/DashboardView.swift
│   │   ├── MapEditor/MapEditorView.swift
│   │   ├── MapEditor/MapCanvasView.swift
│   │   └── Components/ (4 fichiers)
│   ├── ViewModels/
│   │   ├── MapEditorViewModel.swift
│   │   ├── ClassroomViewModel.swift
│   │   └── DashboardViewModel.swift
│   ├── Services/
│   │   ├── AuthService.swift
│   │   ├── Export/ExportService.swift
│   │   └── Cloud/ (2 fichiers)
│   └── Theme/Theme.swift
```

## Structure du projet Web

```
GeoCarte-Web/
├── index.html              # Page principale
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (hors ligne)
├── css/
│   ├── style.css           # Styles principaux
│   ├── editor.css          # Styles éditeur
│   └── components.css
├── js/
│   ├── app.js              # Logique principale
│   ├── editor.js           # Éditeur canvas
│   └── storage.js          # Stockage local
└── img/                    # Icônes
```

## Fonctionnalités implémentées

### Authentification
- Comptes élèves et enseignants
- Connexion/inscription
- Sauvegarde locale

### Éditeur de cartes
- 15 styles: politique, physique, satellite, relief, muette, etc.
- 7 projections: Mercator, Peters, Robinson, polaire, etc.
- Outils: rectangle, cercle, triangle, étoile, flèche, ligne, pinceau, stylo, surligneur, gomme, texte
- 9 motifs: plein, hachures, points, croix, rayures, quadrillage
- Gestion des calques (visibilité, verrouillage)
- Légende automatique
- Couleurs personnalisables
- Épaisseur et opacité réglables
- Déplacement et zoom (pinch, scroll)
- Annuler/Refaire

### Gestion (Enseignant)
- Créer/supprimer des classes
- Ajouter des élèves
- Créer des devoirs
- Tableau de bord avec statistiques

### Travail (Élève)
- Voir les devoirs
- Créer/modifier des cartes
- Soumettre des travaux
- Voir les notes

### Export
- PNG
- Sauvegarde automatique

### Hors ligne (Web)
- Service Worker pour cache
- Fonctionne sans internet
- Installable sur l'écran d'accueil

## Comment lancer

### Version Web (recommandé sans Xcode)
```bash
cd "/Users/marieleclercq/Documents/Default Project/GeoCarte-Web"
python3 -m http.server 8000
```
Puis ouvrir `http://localhost:8000` sur iPad

### Version iOS
```bash
open "/Users/marieleclercq/Documents/Default Project/GeoCarte/GeoCarte.xcodeproj"
```

## Technologies

- **iOS**: SwiftUI, SwiftData, CloudKit, MVVM
- **Web**: HTML5, CSS3, JavaScript vanilla, Canvas API, Service Worker
- **Design**: iOS-like, Liquid Glass, mode sombre, responsive

## Évolutions futures possibles

- MapLibre pour vrais fonds de carte
- Synchronisation cloud
- Mode collaboratif
- IA pour correction
- Apple Pencil
- Version Android
