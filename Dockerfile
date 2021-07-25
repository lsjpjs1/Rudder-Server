FROM node:12-alpine
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . .
CMD ["npm","start","./bin/www"]
EXPOSE 3000