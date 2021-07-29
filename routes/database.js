require('dotenv').config({path:'./.env'});

const {Pool} = require('pg')
const client = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_HOST),
    database: process.env.DB_DATABASE,
})


module.exports = client