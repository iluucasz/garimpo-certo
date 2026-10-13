# Worker de importação do catálogo (VPS). Contexto de build: a raiz do repositório (ou o subconjunto
# enviado: worker/, lib/ e tsconfig.json). Build:  docker build -f worker/Dockerfile -t garimpo-importer:<tag> .
#
# A imagem leva só o worker empacotado (esbuild) e 3 dependências de runtime; o Next.js e o restante do
# site não entram. Segredos nunca ficam na imagem: chegam por --env-file.

FROM node:22-slim AS build
WORKDIR /src
RUN npm install --prefix /tools --no-audit --no-fund esbuild@0.25.12
COPY tsconfig.json ./
COPY lib ./lib
COPY worker ./worker
RUN /tools/node_modules/.bin/esbuild worker/importer.ts \
      --bundle --platform=node --format=esm --target=node22 --packages=external \
      --tsconfig=tsconfig.json --outfile=/out/importer.mjs

FROM node:22-slim
ENV NODE_ENV=production TZ=America/Sao_Paulo
WORKDIR /app
COPY worker/package.json worker/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /out/importer.mjs ./importer.mjs
USER node
CMD ["node", "importer.mjs"]
