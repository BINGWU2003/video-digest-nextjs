FROM node:22-bookworm AS base

ARG APT_MIRROR=""
ARG APT_SECURITY_MIRROR=""

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN set -eux; \
  if [ -n "$APT_MIRROR" ]; then \
    sed -i "s|http://deb.debian.org/debian|$APT_MIRROR|g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  if [ -n "$APT_SECURITY_MIRROR" ]; then \
    sed -i "s|http://deb.debian.org/debian-security|$APT_SECURITY_MIRROR|g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  apt-get -o Acquire::Retries=5 update; \
  apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip; \
  rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY . .

RUN python3 -m pip install --break-system-packages \
  -r scripts/asr/requirements.txt \
  yt-dlp
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=worker

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "worker", "start"]
