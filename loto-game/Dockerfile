# Stage 1: Build the client
FROM node:18 AS build-client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Setup the server
FROM node:18
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
COPY --from=build-client /app/client/dist ./client/dist

# Cloud Run defaults to 8080
ENV PORT 8080
EXPOSE 8080

CMD ["node", "server/index.js"]
