FROM node:20-slim

# نصب پایتون، ffmpeg و yt-dlp (آخرین نسخه)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
        curl \
        ca-certificates \
    && pip3 install --upgrade --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# کپی فایل‌های پروژه
COPY package*.json ./
COPY . .

# نصب پکیج‌ها و بیلد کردن Next.js
RUN npm install --legacy-peer-deps
RUN npm run build

# پورت رو از متغیر محیطی می‌خونیم (Railway خودش ست می‌کنه)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
