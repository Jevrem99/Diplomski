# Front end (Angular) u dve faze:
#  1) build: Node pravi produkcioni build (statički HTML/JS/CSS)
#  2) završna slika je samo nginx + gotovi fajlovi (mala, bez Node-a)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
