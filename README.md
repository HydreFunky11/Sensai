# 🧠 SensAI - Lecteur de Mangas Intelligent & Apprentissage du Japonais (OCR / SRS)

SensAI est une application web d'apprentissage du japonais conçue pour éliminer les frictions de lecture de mangas en version originale (VO). Grâce à une chaîne de traitement combinant la reconnaissance d'écriture locale et l'intelligence artificielle, l'application permet de lire des scans de mangas, de détourer les bulles de dialogue pour obtenir une traduction contextualisée instantanée, et de sauvegarder ce vocabulaire dans un système de révision espacée (SRS).

---

## 🎯 À quoi ça sert ? (Objectifs Fonctionnels)

Pour un apprenant du japonais, lire un manga original est un excellent moyen d'immersion, mais le processus est constamment interrompu par la recherche de vocabulaire complexe. Les kanjis exigent de connaître leurs clés ou de tenter un dessin manuel imprécis sur un dictionnaire.

SensAI résout cela en proposant :
*   **Un Lecteur de Mangas Double-Page** : Support des images et des documents PDF (avec découpage dynamique à l'import pour économiser la mémoire).
*   **Un Détourage OCR Instantané** : L'utilisateur entoure à la souris ou au doigt une bulle de dialogue japonaise (écriture verticale ou horizontale) et l'application en extrait le texte japonais.
*   **Une Traduction Contextuelle & Grammaticale** : Une IA traduit la phrase en français en l'adaptant au contexte de la scène, fournit la prononciation en Romaji, et décompose la phrase mot par mot avec leur rôle grammatical.
*   **Un Système de Répétition Espacée (SRS)** : Les mots traduits peuvent être ajoutés sous forme de fiches (*flashcards*) révisables au clavier selon l'algorithme scientifique **SM-2** (SuperMemo 2).
*   **Un Tracé de Caractères Guidé** : Pour l'apprentissage des alphabets (Hiragana/Katakana), un canvas tactile interactif valide l'ordre et la direction des traits en temps réel.

---

## 🛠️ Pourquoi et comment ça fonctionne ? (Architecture Technique)

SensAI s'appuie sur une architecture découplée moderne et industrialisée :



### 1. Le Frontend (React & Vite)
Une Single Page Application (SPA) développée avec **React 19** et **Vite**, hautement responsive et optimisée.
*   **Accessibilité (A11y)** : Conforme au RGAA/WCAG (navigation 100% au clavier, indicateurs de focus visibles violet néon, attributs sémantiques WAI-ARIA, zone d'annonces vocales `aria-live`).

### 2. Le Backend (FastAPI & Python)
Une API REST performante gérant l'orchestration des données, les traitements lourds et les interconnexions IA.
*   **Sécurité (OWASP)** : Mots de passe chiffrés avec `bcrypt`, session par jetons d'accès **JWT**, middleware d'en-têtes HTTP de protection, Rate Limiting par IP et intercepteur global d'erreurs 500 anonymisant les réponses.
*   **Gestion de fichiers** : Filtres binaires vérifiant la signature des fichiers (Pillow) contre les malwares déguisés, limite à 100 Mo et renommage par UUID.
*   **Respect du RGPD** : Suppression de compte (purge complète de la base de données en cascade et destruction physique des fichiers mangas du disque) et export de profil au format standard JSON.

### 3. Les Moteurs d'Intelligence Artificielle (OCR & LLM)
*   **Manga-OCR (Local)** : Un modèle de Deep Learning basé sur des réseaux de neurones convolutionnels (CNN/Transformer), pré-entraîné spécifiquement sur le texte de manga vertical et les polices japonaises. Il s'exécute localement sur le serveur.
*   **Llama 3 (via Groq API)** : Utilisé pour la traduction contextuelle et le découpage lexical. Groq permet d'obtenir des temps de réponse inférieurs à 1 seconde.

---

## 📥 Guide d'Installation

### 📋 Prérequis
*   [Git](https://git-scm.com)
*   [Docker Engine](https://docs.docker.com/engine/install/) et [Docker Compose](https://docs.docker.com/compose/install/) (Recommandé)
*   *Ou alternativement en local* : [Python 3.12](https://www.python.org/downloads/) et [Node.js v22 LTS](https://nodejs.org/).

---

### 🐳 Méthode A : Déploiement rapide avec Docker (Recommandé)

1.  **Cloner le projet** :
    ```bash
    git clone https://github.com/HydreFunky11/Sensai.git
    cd Sensai
    ```

2.  **Configurer les variables d'environnement** :
    Créez un fichier `.env` dans le dossier `manga-ocr/` :
    ```bash
    touch manga-ocr/.env
    ```
    Ajoutez-y les configurations requises :
    ```ini
    SECRET_KEY=cle_secrete_jwt_aleatoire_et_securisee
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=1440
    GROQ_API_KEY=gsk_votre_cle_api_groq
    STRIPE_API_KEY=sk_test_votre_cle_stripe
    STRIPE_WEBHOOK_SECRET=whsec_votre_secret_webhook
    FRONTEND_URL=http://localhost
    ```

3.  **Lancer l'application** :
    À la racine du projet, exécutez la commande d'orchestration :
    ```bash
    docker compose up --build -d
    ```

4.  **Accéder à l'application** :
    Ouvrez votre navigateur sur `http://localhost`. Le conteneur Nginx sert le frontend, tandis que l'API backend répond sur le port `8000`.

---

### 💻 Méthode B : Installation en local (Développement)

#### 1. Configuration du Backend (FastAPI)
1.  Naviguez dans le répertoire backend :
    ```bash
    cd manga-ocr
    ```
2.  Créez et activez un environnement virtuel Python :
    *   *Linux/macOS* : `python3 -m venv venv && source venv/bin/activate`
    *   *Windows (PowerShell)* : `python -m venv venv && .\venv\Scripts\Activate.ps1`
3.  Installez les dépendances (PyTorch CPU puis les modules requis) :
    ```bash
    pip install --upgrade pip
    pip install torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu
    pip install -r requirements.txt
    ```
4.  Configurez le fichier `.env` dans `manga-ocr/` (comme indiqué dans la méthode Docker).
5.  Démarrez le serveur FastAPI :
    ```bash
    python main.py
    ```
    L'API est en ligne sur `http://127.0.0.1:8000`.

#### 2. Configuration du Frontend (React)
1.  Ouvrez un nouveau terminal et naviguez dans le répertoire frontend :
    ```bash
    cd frontend
    ```
2.  Installez les dépendances Node.js :
    ```bash
    npm install
    ```
3.  Démarrez le serveur de développement Vite :
    ```bash
    npm run dev
    ```
    L'interface est accessible sur `http://localhost:5173`.

---

## 🧪 Validation de la Qualité & Tests

Pour exécuter les suites de tests automatisées du projet :

*   **Tests Backend (Pytest)** :
    ```bash
    cd manga-ocr
    venv/bin/pytest
    ```
*   **Tests Frontend (Vitest)** :
    ```bash
    cd frontend
    npm run test
    ```