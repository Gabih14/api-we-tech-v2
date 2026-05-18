FROM node:20-alpine

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10.25.0 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "run", "start:prod"]