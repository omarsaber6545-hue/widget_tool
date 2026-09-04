FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# المجلد المخصص لحفظ بيانات الحالة والوقت المنقضي بشكل دائم
VOLUME ["/app/data"]

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
