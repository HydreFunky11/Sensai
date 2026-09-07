---
name: Signalement d'anomalie (Bug report)
about: Signaler un bogue de fonctionnement pour qualification et correction.
title: "[BUG] "
labels: "type:bug"
assignees: ""
---

## 📝 Description de l'anomalie
*Fournissez une description claire et concise de l'anomalie rencontrée.*

### Comportement observé (actuel)
*Qu'est-ce qui se passe réellement ?*

### Comportement attendu
*Qu'est-ce qui devrait normalement se passer ?*

---

## 🛠️ Étapes de reproduction (Obligatoire)
*Décrivez précisément comment reproduire l'anomalie pas-à-pas.*

1. Aller sur la page '...'
2. Cliquer sur le bouton '...'
3. Importer le fichier '...' (ou détourer la zone '...')
4. Constater l'erreur suivante : '...'

---

## 💻 Environnement de test
- **Version de l'application** : (ex: v1.1.0)
- **Système d'exploitation** : (ex: Windows 11, macOS Sequoia, Linux Ubuntu)
- **Navigateur web** : (ex: Google Chrome, Firefox, Safari)
- **Mode d'exécution** : (ex: Docker Compose local / Dev local / Production)

---

## 📁 Journaux & Captures d'écran
*Insérez les logs correspondants extraits de `sensai.log` ou de la console JavaScript du navigateur, ainsi que des captures d'écran si pertinent.*

```text
Insérer les logs ici...
```

---

## ⚙️ Volet Correction (Réservé aux développeurs)
- [ ] L'anomalie a été reproduite avec succès en local.
- [ ] Une branche de correctif dédiée `hotfix/...` ou `feature/...` a été créée.
- [ ] Un test unitaire de non-régression validant la correction a été écrit et ajouté à la suite de tests.
- [ ] Le correctif a été vérifié et validé par les tests de la CI/CD.
