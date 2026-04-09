FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# Cache-bust: force rebuild on every deploy
ARG CACHE_BUST=1
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
