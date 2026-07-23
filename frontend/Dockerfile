FROM node:25.0.0 AS base

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

FROM base AS development

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS build

ARG VITE_ETH_RPC_URL=http://localhost:8545
ENV VITE_ETH_RPC_URL=$VITE_ETH_RPC_URL

RUN npm run build

FROM nginx:1.29.2 AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
