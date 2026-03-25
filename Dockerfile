FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Generate PWA icons
RUN node generate-icons.js

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]
