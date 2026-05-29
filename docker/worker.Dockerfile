FROM node:22-bookworm AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY . .

RUN python3 -m pip install --break-system-packages \
  -r scripts/asr/requirements.txt \
  yt-dlp
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "worker", "start"]
