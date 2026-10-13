# Back end (Node.js + Express + Prisma). Debian "slim": Prisma radi bez dodatnog podešavanja, samo treba openssl.
FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Prvo samo spisak paketa i šema: dok se oni ne menjaju, Docker koristi keširan "npm ci"
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Prisma CLI je u devDependencies, a koristi se pri pripremi baze, pa se instalira sve
RUN npm ci && npx prisma generate

COPY . .

ENV NODE_ENV=production \
    TZ=Europe/Belgrade \
    PORT=5000
EXPOSE 5000

# Pri svakom pokretanju: napravi bazu ako je prazna (ili dodaj nova polja), pa startuj server
CMD ["sh", "-c", "node scripts/pripremi-bazu.js && node src/server.js"]
