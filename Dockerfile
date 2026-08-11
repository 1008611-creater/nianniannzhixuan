FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY --chown=node:node package.json server.mjs proxy-headers.mjs ./
COPY --chown=node:node public ./public

RUN test -s public/index.html \
    && test -s public/workspace.html \
    && test -s public/app.compat.js \
    && test -s public/workspace-v206.js \
    && test -s public/assets/niannian-ai-logo-128.webp

ENV HOST=0.0.0.0 \
    PORT=18893 \
    NODE_ENV=production

USER node

EXPOSE 18893

CMD ["node", "server.mjs"]
