FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ext_proc.proto ./
EXPOSE 9000
CMD ["node", "server.js"]
