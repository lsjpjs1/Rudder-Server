require('dotenv').config({ path: './.env' });
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ = 'Asia/Tokyo'
const request = require('request')
const apn = require('apn')
const client = require("./database");

module.exports.insertUserActivity = async function (user_info_id,activityType) {
    await client.query("BEGIN")
    await client.query("insert into user_activity values (default,$1,default,$2)",[user_info_id,activityType])
    await client.query("COMMIT")
}

