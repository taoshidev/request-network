# Check https://hub.docker.com/_/node to see other available Node.js versions
FROM node:19

ENV MIGRATE=true

RUN apt-get update && apt-get install -y netcat-openbsd

WORKDIR /usr/src/app

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

# ENV PATH="/usr/src/app/node_modules/.bin:$PATH"

RUN pnpm build

RUN ls -al ./dist
RUN echo $PATH
RUN ls node_modules/.bin

RUN chmod +x ./start.sh

EXPOSE 8080

CMD ["pnpm", "start"]
