# 🚀 SensIA : Roadmap Qualité & Ingénierie Logicielle

Ce document définit les standards de qualité et les processus de déploiement à implémenter pour passer le projet SensIA en production (Niveau Expert).

## 1. 🛠 Clean Code & Standards de Développement
- **Principes SOLID** : Garantir le découpage des responsabilités (ex: séparer l'orchestration API du traitement pur OCR).
- **Static Analysis** : 
  - Python : Utilisation de `Ruff` ou `Pylint` pour garantir le respect de la PEP 8.
  - JS/React : `ESLint` avec configuration `AirBnB` ou `Standard`.
- **Typage Fort** : Utilisation systématique de `Pydantic` (Backend) et `TypeScript` (à moyen terme pour le Frontend).

## 2. 🌿 Stratégie Git & Collaboration (Git Flow)
- **Conventional Commits** : Chaque commit doit respecter le format `type(scope): description` (ex: `feat(ocr): add easyocr multilingual support`).
- **Merge Requests (MR)** : 
  - Aucune fusion sur `main` sans au moins une approbation (Code Review).
  - Validation automatique par la CI avant chaque merge.
- **Branches** : `main` (production), `develop` (intégration), `feature/*`, `fix/*`.

## 3. 🧪 Stratégie de Test (Validation)
- **Tests Unitaires (TU)** : 
  - Backend : `Pytest` (objectif 80% de couverture sur les services IA).
  - Frontend : `Vitest` / `React Testing Library`.
- **Tests d'Intégration** : Vérifier la chaîne complète : Upload Image -> OCR -> LLM.

## 4. 🚀 Pipeline CI/CD (Clean Deployment)
- **CI (GitHub Actions / GitLab CI)** : 
  - Déclenchement à chaque push/MR.
  - Étapes : Lint -> Format Check -> Unit Tests -> Build.
- **CD (Déploiement Continu)** : 
  - Build d'images Docker multi-stage pour optimiser la taille.
  - Déploiement automatisé sur serveur (VPS/Cloud) après succès de la CI.

## 5. 📊 Monitoring & Maintenance
- Centralisation des logs (Sentry / ELK).
- Alerting en cas d'échec critique de l'inférence LLM ou dépassement de quota API.
