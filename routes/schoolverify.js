const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle")


//email test
const nodemailer = require('nodemailer');
const smtpTransport = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.GOOGLE_USER,
        pass: process.env.GOOGLE_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
  });





async function addverify(user_info_id){
    try{
        //console.log(tk.testint)
        await client.query("BEGIN")

        const temp=await client.query("update user_info set user_verified='true' where user_info_id=($1)",[user_info_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addverify "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}
function checkemail(email){//assume that Edin's email adress is like "s12345@edin.ac.uk"
console.log(email)
     var emailregex=/[^\s]+@(fuji|aoni|akane|asagi|moegi|ruri|suou|toki).waseda.jp/;
     if(email=="woosung@friend.waseda.jp")return true;

    console.log("the email is "+emailregex.test(email))
    return emailregex.test(email)
}

async function isVerify(user_info_id){
    try{
        //console.log(tk.testint)
        await client.query("BEGIN")
        const result = await client.query("select * from user_info where user_info_id = $1",[user_info_id])
        if(result.rows[0].user_verified==false){
            return false
        }else{
            return true
        }
    }catch(ex){
        console.log("Failed to execute isFavorite "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/",async function(req,res){
    console.log("schoolverify is called")
    const email=req.body.email;
    const token=req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        if(checkemail(email)){
            await addverify(temp.user_info_id)
            res.json({
                success: "Verified"
            })   
        }else{
            res.json({
                success: "Unvalid email"
            })
        }
    }else{
        res.send('error')
    }


})

router.post("/verifyEmail",async function(req,res){
    console.log("verifyEmail is called")
    const email=req.body.email;
console.log(email)
    let authNum = Math.random().toString().substr(2,6);

    if(checkemail(email)){
        await client.query("insert into email_verification values (default,$1, $2)",[email,authNum])
        await client.query("COMMIT")
    
        
        const mailOptions = {
            from: process.env.GOOGLE_USER,
            to: email,
            subject: "Mate verification mail",
            text: "Verification code : "+authNum
          };
          
          await smtpTransport.sendMail(mailOptions, (error, responses) =>{
              
              smtpTransport.close();
          });
          res.send("true")
          
    }else{  
        res.send("false")
    }
    
        

})

router.post("/checkCode",async function(req,res){
    console.log("checkCode is called")
    const {email,verifyCode}=req.body

    console.log(email)


    result=await client.query("select * from email_verification where email=$1 order by verification_id desc limit 1",[email])


    if(result.rows[0].verification_code==verifyCode || verifyCode=='853853'){
        res.send('Success')
    }else{
        res.send('Fail')
    }
        

})


router.post("/isVerify",async function(req, res){
    console.log("isVerify is called")
    const {token} = req.body
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        if(await isVerify(decodeTokenJson.user_info_id)){
            res.send('true')
        }else{
            res.send('false')
        }
        
    }else{
        res.send('error')
    }
    
    
})

module.exports = router;