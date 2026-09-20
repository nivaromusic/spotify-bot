FROM node:20-slim

# نصب پایتون، ffmpeg و yt-dlp (آخرین نسخه از GitHub)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
        curl \
        ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
        -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY . .

RUN npm install --legacy-peer-deps
RUN npm run build

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
