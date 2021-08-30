FROM node:14-alpine
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . .
CMD ["npm","start"]
EXPOSE 3000