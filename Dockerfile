FROM node:20-slim

# نصب پایتون، ffmpeg و yt-dlp
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    pip3 install --break-system-packages yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# کپی فایل‌های پروژه
COPY package*.json ./
COPY . .

# نصب پکیج‌ها و بیلد کردن Next.js
RUN npm install
RUN npm run build

# پورت رو از متغیر محیطی می‌خونیم (Railway خودش ست می‌کنه)
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
