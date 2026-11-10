# Multi-stage build for the React Router SSR web app.
FROM node:22-alpine AS build
WORKDIR /src
# Install pnpm globally and copy lockfile.
RUN npm install -g pnpm@9.15.9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /src/build ./build
COPY --from=build /src/package.json ./package.json
COPY --from=build /src/node_modules ./node_modules
EXPOSE 3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]
