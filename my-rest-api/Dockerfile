FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm install

FROM dependencies AS build
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]