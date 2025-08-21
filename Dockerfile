FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN npm i
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY *.env ./
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist .
EXPOSE 3000
CMD ["npm", "run", "start"]
# CMD ["/bin/sh"]
