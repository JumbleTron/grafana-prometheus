FROM node:20.10.0-alpine

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY package.json package-lock.json ./

RUN npm install

COPY src/ .

EXPOSE 5555

CMD [ "npm", "start"]