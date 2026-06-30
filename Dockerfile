FROM node:24-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY docs ./docs

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
