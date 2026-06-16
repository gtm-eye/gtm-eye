# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.1.0] – 2025-06-12

### Added
- Intégration complète de la nouvelle librairie `gtm-lib` (`gtmDataParser`, `gtmDataExtractor`, `gtmHelper`).
- Refactorisation complète de la fonction `isGtmScript()` avec séparation des responsabilités dans des modules dédiés.
- Refonte de l'UI avec les tags affichés en ligne 


### Fixed
- Correction d’un bug critique empêchant l’extraction correcte de l’identifiant GTM (`GTM-XXXXXX`) depuis les scripts suite à une mise à jour du format par Google.
- Meilleure robustesse dans la détection des balises GTM, y compris en cas de guillemets simples ou doubles.

