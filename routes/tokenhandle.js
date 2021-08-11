require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ='Asia/Tokyo'
//app.set('JWT_SECRET', SECRET_KEY)
module.exports.jwt
module.exports.SECRET_KEY

module.exports.decodeToken=async function (token){
    return jwt.verify(token,SECRET_KEY,(error,decoded)=>{
        if(error){
            console.error(error)
            a={valid:false,user_id:''}
            return JSON.stringify(a)
        }
        a={valid:true,user_id:decoded.user_id,user_info_id:decoded.user_info_id}
        return JSON.stringify(a)
    })
}
z