# Journal des Versions (Changelog) - SensAI

Toutes les modifications notables apportées au projet **SensAI** sont consignées dans ce fichier, conformément aux principes du [versionnement sémantique](https://semver.org/lang/fr/) (SemVer) et du standard [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [1.2.0] - 2026-08-19

### Ajouté
*   **Sonde de santé applicative (`C4.1.2`)** : Endpoint `/health` dans l'API FastAPI permettant de monitorer l'état de fonctionnement du backend et de la base de données SQLite.
*   **Suivi des dépendances (`C4.1.1`)** : Configuration du fichier `.github/dependabot.yml` pour planifier des audits hebdomadaires de sécurité sur les packages Python (backend) et npm (frontend).
*   **Template de bogues (`C4.2.1`)** : Intégration du template GitHub d'issue `.github/ISSUE_TEMPLATE/bug.md` pour normaliser et accélérer la consignation, qualification et reproduction des anomalies.

### Modifié
*   **Suites de tests** : Ajout de tests automatisés validant la sonde de santé et le gestionnaire global d'exceptions 500 dans la CI/CD.

---

## [1.1.0] - 2026-07-22

### Ajouté
*   **Sécurisation OWASP (`C2.2.3`)** : Mise en place de middlewares injectant les en-têtes HTTP de sécurité (X-Frame-Options, HSTS, Content-Type protection).
*   **Rate Limiting** : Limiteur de requêtes par adresse IP sur les routes sensibles (connexion, OCR, TTS) pour prévenir les attaques DDoS et de force brute.
*   **Conformité RGPD (`C2.2.1`)** : Droit à la portabilité avec export JSON du profil utilisateur et droit à l'oubli total (suppression en cascade en BDD et suppression physique des PDF importés sur le disque).
*   **Accessibilité A11y (`C2.2.3`)** : Navigation 100% au clavier sur le lecteur et le SRS, anneaux de focus violet néon contrastés, et annonces vocales pour les technologies d'assistance avec `aria-live`.
*   **Rotative Logging (`C2.4.1`)** : Mise en place de la rotation de journaux d'audit (`sensai.log` de 5 Mo max et 3 copies d'historique).
*   **Gestionnaire global d'erreurs 500** : Exception Handler global masquant les traces de crash systèmes et renvoyant une réponse anonymisée.
*   **Pipelines CI/CD (`C2.2.4`)** : Découpage des workflows GitHub Actions en deux chaînes indépendantes et optimisées : `backend-ci.yml` et `frontend-ci.yml`.

### Corrigé
*   **B-001 (Mémoire PDF)** : Résolution de la fuite de mémoire système (crash par manque de RAM) lors du traitement de volumineux mangas PDF en introduisant un découpage de flux dynamique via PyMuPDF.
*   **B-002 & B-003 (Accessibilité)** : Correction des tests unitaires ARIA (Vitest) et de la perte de focus clavier sur le canvas de dessin interactif.
*   **B-004 (CI/CD PyTorch)** : Résolution du blocage du pipeline de build lié à l'installation par défaut de PyTorch GPU en forçant l'image CPU légère.

---

## [1.0.0] - 2026-06-20

### Ajouté
*   **Lecteur de Manga** : Double-page, zooms, et gestion de la bibliothèque personnelle de scans (PDF / Images).
*   **OCR & Traduction** : Outil de détourage à la souris/tactile, extraction locale du japonais par Manga-OCR et analyse grammaticale automatisée via l'API Groq (Llama 3).
*   **Système SRS** : Création automatique de flashcards à partir des bulles lues et algorithme de répétition espacée (SuperMemo SM-2).
*   **Entraînement aux Écritures** : Modules interactifs avec tracé de caractères sur grille SVG validant l'ordre des traits (Hiragana/Katakana).
*   **Dockerisation** : Environnement d'orchestration multi-conteneurs opérationnel (`Dockerfile` de production et `docker-compose.yml`).
