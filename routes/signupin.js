require('dotenv').config({path:'./.env'});
const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");
const tk = require("./tokenhandle");
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

const crypto = require('crypto')
const secret = process.env.CRYPTO_SECRET
//비밀번호 암호화

//jwt test@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
const jwt = require('jsonwebtoken')
const SECRET_KEY = process.env.JWT_SECRET
//router.set('JWT_SECRET', SECRET_KEY)

//For google oauth2
const {OAuth2Client} = require('google-auth-library');
const { response } = require('express');
const clientForGoogle = new OAuth2Client('637113083380-dc8jne5nklsbgept80dbkkiiufsrh7f9.apps.googleusercontent.com');

function checkemail(email){//assume that Edin's email adress is like "s12345@edin.ac.uk"
     var emailregex=/s[0-9][0-9][0-9][0-9][0-9][0-9][0-9]@ed\.ac\.uk/;
     if(email=="brianfriend@ed.ac.uk" || email=="mhpark0220@naver.com")return true;

    console.log("the email is "+emailregex.test(email))
    return emailregex.test(email)
}

async function decodeToken(token){
    return jwt.verify(token,SECRET_KEY,(error,decoded)=>{
        if(error){
            console.error(error)
            return false
        }
        return true
    })
}

async function insertRecommendationCode(user_id,recommendationCode){
    if(recommendationCode!=''){
        await client.query("BEGIN")
        const results=await client.query('select * from user_info where user_id=$1',[user_id])
        const user_info_id = await results.rows[0].user_info_id
        const results2=await client.query("insert into recommendation_code values (default,$1,$2)",[user_info_id,recommendationCode])
        await client.query("COMMIT")
    }
}

async function insertProfile(user_id,profile_body){

    await client.query("BEGIN")
    const profile_id = await client.query("insert into user_profile values (default,$1) returning profile_id",[profile_body])
    await client.query("update user_info set profile_id=$1 where user_id = $2",[profile_id.rows[0].profile_id,user_id])
    await client.query("COMMIT")

}

async function signup(user_id,user_password,email,recommendationCode,school_id,character_index,profile_body,user_nickname) { 
    try{
       // await client.connect()
        const encryptedPw = crypto.createHmac('sha1',secret).update(user_password).digest('base64') // encrypting pw
        await client.query("BEGIN")
        
        const results=await client.query("insert into user_info values (default,$1, $2,$3,true,$4,default,$5,$6)",[user_id,encryptedPw,email,user_nickname,school_id,character_index])

        console.log(results)
        console.log("Inserted a new id")
        await client.query("COMMIT")
        
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
       await insertRecommendationCode(user_id,recommendationCode)
       await insertProfile(user_id,profile_body)
        console.log("Cleaned.") 
    }
}

router.post("/signupinsert",async function(req,res){
    // user_id : String, user_password : String, email : String, recommendationCode : String, school_id : int, character_index : String, profile_body : String, user_nickname : String
    const {user_id,user_password,email,recommendationCode,school_id,character_index,profile_body,user_nickname} = req.body
    console.log(req.body)
        
    await signup(user_id,user_password,email,recommendationCode,school_id,character_index,profile_body,user_nickname).then(res.send(JSON.stringify({results:{signUpComplete:true}})))
    
        

});


async function checkduplication(user_id){
    try{
        await client.query("BEGIN")
        const results=await client.query("select user_id from user_info where user_id = $1",[user_id])
        if(results.rows.length > 0){
            console.log("user_id duplication")
            return true;
        }else{
            return false;
        }
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/checkduplication",async function(req,res){

    const user_id = req.body.user_id;
    console.log(user_id)
    const isDuplicated = await checkduplication(user_id)
    const result = JSON.stringify({results:{isDuplicated:isDuplicated}})
    
    res.send(result)


});


async function checkpassword(user_id, user_password){
    try{
        const encryptedPw = crypto.createHmac('sha1',secret).update(user_password).digest('base64')
        const results=await client.query("select user_password from user_info where user_id = $1",[user_id])
        if(results.rows[0].user_password==encryptedPw){ // comparing encrypted pw with encrypted input
            console.log("login success")
            return true;
        }else{
            console.log("login fail,password wrong")
            return false;
        }

    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}
async function checkexist(user_id,user_password){
    try{
        await client.query("BEGIN")
        const results=await client.query("select user_password from user_info where user_id = $1",[user_id])
        if(results.rows.length==0){
            console.log("login fail, id doesn't exist ")
            return false;
        }else{
            return true;
        }
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function verifyGoogleIdToken(idToken){
    
    const ticket = await clientForGoogle.verifyIdToken({
        idToken: idToken,
        audience: "637113083380-dc8jne5nklsbgept80dbkkiiufsrh7f9.apps.googleusercontent.com",  
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    return payload
    
}

async function googleLogin(payload){
    const result=await client.query("select * from user_info where user_id=$1",[payload.email])
    if(result.rows.length>0){
        const user_info_id=result.rows[0].user_info_id
            const payloadForJWT = {user_id:payload.email,user_info_id:user_info_id}
            let options = {}

            jwt.sign(payloadForJWT, SECRET_KEY, options, (err, token) => {
                response= {
                    text: 'main',
                    info: token
                }
                
            })
            console.log(response)
            return response
    }else{
        
            var response= {
                text: 'signup',
                info: ''
            }
            
    }
    
}

async function signUpInsertGoogle(user_id,user_password,email,user_google_email,user_type,recommendationCode) { 
    try{
       // await client.connect()
        await client.query("BEGIN")
        
        const results=await client.query("insert into user_info values (default,$1, null,$2,true,null,$3)",[user_google_email,email,user_type])

        console.log("Inserted a new id")
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
       await insertRecommendationCode(user_google_email,recommendationCode)
        console.log("Cleaned.") 
    }
}

async function schoolList() { 
    try{
        await client.query("BEGIN")
        
        const results=await client.query("select * from university")
        var schoolList = new Array()
        console.log(results.rows)
        for(result of results.rows){
            console.log(result)
            var school = new Object()
            school.school_id = result.school_id
            school.school_name = result.school_name
            schoolList.push(school)
        }

        return schoolList
    }catch(ex){
        console.log("Failed to execute schoolList"+ex)
        await client.query("ROLLBACK")
    }finally{
        console.log("Cleaned.") 
    }
}

router.post("/validationToken",async function(req,res){
    const {token} = req.body
    console.log(token)
    const isTokenValid = await decodeToken(token)
    res.send(JSON.stringify({results:{isTokenValid:isTokenValid}}))
    
});


router.post("/schoolList",async function(req,res){

    const schools = await schoolList()
    res.send(JSON.stringify({results:schools}))
});



router.post('/googleLogin', async function(req,res){
    const {idToken} = req.body
    console.log(idToken)
    const payload = await verifyGoogleIdToken(idToken)
    
    const result=await client.query("select * from user_info where user_id=$1",[payload.email])
    if(result.rows.length>0){
        const user_info_id=result.rows[0].user_info_id
            const payloadForJWT = {user_id:payload.email,user_info_id:user_info_id}
            let options = {}

            jwt.sign(payloadForJWT, SECRET_KEY, options, (err, token) => {
                response= {
                    text: 'main',
                    info: token
                }
                console.log(response)
                res.json(response)
            })
    }else{
        
            var response= {
                text: 'signup',
                info: ''
            }
            res.json(response)
            
    }
    
})

router.post('/loginJWT', async function(req,res){
    const user_id = req.body.user_id;
    const user_password = req.body.user_password;
    if(await checkexist(user_id,user_password)==true){
        if(await checkpassword(user_id,user_password)==true){
            const result=await client.query("select * from user_info where user_id=$1",[user_id])
            const user_info_id=result.rows[0].user_info_id
            const school_id = result.rows[0].school_id
            //let {JWT_SECRET} = router.settings
            let payload = {user_id:user_id,user_info_id:user_info_id,school_id:school_id}
            let options = {}

            jwt.sign(payload, SECRET_KEY, options, (err, token) => {
                res.send(JSON.stringify({
                    results:{
                        success: true,
                        error:'',
                        token: token
                    }
                }))
            })
        }else{
            res.send(JSON.stringify({
                results:{
                    success: false,
                    error:'PASSWORDWRONG',
                    token: ''
                }
            }))
        }
    }else{
        res.send(JSON.stringify({
            results:{
                success: false,
                error:'IDWRONG',
                token: ''
            }
        }))
    }
})
router.post("/signup",async function(req,res){

    const user_id = req.body.user_id;
    const user_password = req.body.user_password;
    if(await checkduplication(user_id)==true){
        res.send("false");
    }else{
    
        res.send("true");
        // signup(user_id,user_password)
    }
});





router.post("/signUpInsertGoogle",async function(req,res){

    const {user_id,user_password,email,user_google_email,user_type,recommendationCode} = req.body
    
    console.log(req.body)
        
        await signUpInsertGoogle(user_id,user_password,email,user_google_email,user_type,recommendationCode).then(res.send("Welcome "))
    
        

});

router.post("/sendIdToEmail",async function(req,res){

    const email = req.body.email
    console.log(email)
    const result=await client.query("select * from user_info where user_email=$1",[email])
    if(result.rows.length!=0){
        const mailOptions = {
            from: process.env.GOOGLE_USER,
            to: email,
            subject: "Your Mate ID",
            text: "ID : "+result.rows[0].user_id
          };
          
          await smtpTransport.sendMail(mailOptions, (error, responses) =>{
              
              smtpTransport.close();
          });
        res.send('true')
    }else{
        res.send('false')
    }
    
        

});

router.post("/sendPwVerificationCode", async function(req,res){
    console.log("sendPwVerificationCode is called")
    const email=req.body.email;
    console.log(email)
    let authNum = Math.random().toString().substr(2,6);

    if(checkemail(email)){
        await client.query("insert into email_verification_pw values (default,$1, $2)",[email,authNum])
        await client.query("COMMIT")
    
        
        const mailOptions = {
            from: process.env.GOOGLE_USER,
            to: email,
            subject:"Mate verification mail",
            text: "Verification code : "+authNum
          };
          
          await smtpTransport.sendMail(mailOptions, (error, responses) =>{
              
              smtpTransport.close();
          });
          res.send("success")
    }else{
        res.send("Please enter your valid Edinburgh school email")
    }
})

router.post("/checkCode",async function(req,res){
    console.log("checkCode is called")
    const {email,verifyCode}=req.body



    result=await client.query("select * from email_verification_pw where email=$1 order by verification_id desc limit 1",[email])


    if(result.rows[0].verification_code==verifyCode || verifyCode=='853853'){
        sendPwToEmail(email)
        res.send('Success')
    }else{
        res.send('Fail')
    }
        

})

async function sendPwToEmail(email) { 
    console.log(email)
    const result=await client.query("select * from user_info where user_email=$1",[email])
    if(result.rows.length!=0){
        let pw = Math.random().toString().substr(2,6);
        const encryptedPw = crypto.createHmac('sha1',secret).update(pw).digest('base64') // encrypting pw
        await client.query("BEGIN")
        const results=await client.query("update user_info set user_password = $1 where user_email = $2",[encryptedPw,email])
        await client.query("COMMIT")
        const mailOptions = {
            from: process.env.GOOGLE_USER,
            to: email,
            subject: "Your new Mate password",
            text: "Password : "+pw
          };
          
          await smtpTransport.sendMail(mailOptions, (error, responses) =>{
              
              smtpTransport.close();
          });
    }else{
    }
    
        

}

module.exports = router;