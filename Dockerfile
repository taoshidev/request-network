# Check https://hub.docker.com/_/node to see other available Node.js versions
FROM node:19

ENV MIGRATE=true

RUN apt-get update && apt-get install -y netcat-openbsd

WORKDIR /usr/src/app

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

COPY . .

EXPOSE 8080

CMD ["pnpm", "dev:migrate"]
