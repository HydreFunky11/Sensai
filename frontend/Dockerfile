# Étape 1 : Build de l'application React
FROM node:22-alpine AS builder

WORKDIR /app

# Copier les configurations d'installation
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code source frontend
COPY . .

# Compiler l'application de production avec Vite (génère le dossier dist/)
RUN npm run build

# Étape 2 : Serveur Nginx final de production
FROM nginx:alpine

# Copier le fichier de configuration Nginx personnalisé
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers statiques compilés depuis l'étape builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer le port de Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
