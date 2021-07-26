FROM node:12-alpine
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . .
CMD ["forever","./bin/www"]
EXPOSE 3000