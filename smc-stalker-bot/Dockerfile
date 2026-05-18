# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup --system bot && adduser --system --ingroup bot bot

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist/ dist/

USER bot

CMD ["node", "dist/index.js"]
