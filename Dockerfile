FROM node:14

ARG API_KEY_BOT
ARG API_URL
ARG API_MEDIA

ENV API_KEY_BOT=$API_KEY_BOT
ENV API_URL=$API_URL
ENV API_MEDIA=$API_MEDIA

COPY package*.json ./

RUN npm install

COPY . .

RUN touch src/.env
RUN printf 'API_KEY_BOT=%s\n' "$API_KEY_BOT" > src/.env
RUN printf 'API_URL=%s\n' "$API_URL" >> src/.env
RUN printf 'API_MEDIA=%s\n' "$API_MEDIA" >> src/.env

WORKDIR /src

CMD [ "node", "bot.js" ]
