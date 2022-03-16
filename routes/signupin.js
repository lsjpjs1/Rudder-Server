require('dotenv').config({path:'./.env'});
const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");
const tk = require("./tokenhandle");
const nodemailer = require('nodemailer');
const userRecord = require("./userrecord")
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

async function insertProfile(user_id,profile_body,user_profile_image_id){

    await client.query("BEGIN")
    const profile_id = await client.query("insert into user_profile values (default,$1,$2) returning profile_id",[profile_body,user_profile_image_id])
    await client.query("update user_info set profile_id=$1 where user_id = $2",[profile_id.rows[0].profile_id,user_id])
    await client.query("COMMIT")

}

async function logout(user_info_id){
    try{
        await client.query("BEGIN")
        await client.query("update user_info set os=null,notification_token=null where user_info_id = $1",[user_info_id])
        await client.query("COMMIT")
        return true
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}
//완료
router.post("/logout",async function(req,res){

    const {token} = req.body
    try {
        if(tk.decodeToken(token)){
            var temp = jwt.verify(token,SECRET_KEY)
            const isSuccess = await logout(temp.user_info_id)
            if(isSuccess){
                res.send(JSON.stringify({results:{isSuccess:true}}))
            } else{
                res.send(JSON.stringify({results:{isSuccess:false}}))
            }
        }else{
            res.send(JSON.stringify({results:{isSuccess:false}}))
        }
    } catch (error) {
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
    

});

async function signup(user_id,user_password,email,recommendationCode,school_id,profile_body,user_nickname,user_profile_image_id=1) { 
    try{
       // await client.connect()
        const encryptedPw = crypto.createHmac('sha1',secret).update(user_password).digest('base64') // encrypting pw
        await client.query("BEGIN")
        
        const results=await client.query("insert into user_info values (default,$1, $2,$3,$4,default,$5)",[user_id,encryptedPw,email,user_nickname,school_id])

        console.log(results)
        console.log("Inserted a new id")
        await client.query("COMMIT")
        
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
       await insertRecommendationCode(user_id,recommendationCode)
       await insertProfile(user_id,profile_body,user_profile_image_id)
        console.log("Cleaned.") 
    }
}

//완료
router.post("/signupinsert",async function(req,res){
    // user_id : String, user_password : String, email : String, recommendationCode : String, school_id : int, character_index : String, profile_body : String, user_nickname : String
    const {user_id,user_password,email,recommendationCode,school_id,profile_body,user_nickname,user_profile_image_id} = req.body
    console.log(req.body)
        
    await signup(user_id,user_password,email,recommendationCode,school_id,profile_body,user_nickname,user_profile_image_id).then(res.send(JSON.stringify({results:{signUpComplete:true}})))
    
        

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

async function checkDuplicationNickname(nickname){
    try{
        await client.query("BEGIN")
        const results=await client.query("select user_nickname from user_info where user_nickname = $1",[nickname])
        if(results.rows.length > 0){
            console.log("user_nickname duplication")
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

router.post("/checkDuplicationNickname",async function(req,res){

    const nickname = req.body.nickname;
    console.log(nickname)
    const isDuplicated = await checkDuplicationNickname(nickname)
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



async function schoolList() { 
    try{
        await client.query("BEGIN")
        
        const results=await client.query("select * from university order by school_id")
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

async function updateNotificationToken(os,notification_code,user_id) { 
    try{
        await client.query("BEGIN")
        
        await client.query("update user_info set os = $1, notification_token = $2 where user_id = $3",[os,notification_code,user_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute updateNotificationToken"+ex)
        await client.query("ROLLBACK")
    }finally{
        console.log("Cleaned.") 
    }
} 

async function profileImageList() { 
    try{
        await client.query("BEGIN")
        
        const results=await client.query("select * from user_profile_image")
        var profileImageList = new Array()
        for(var result of results.rows){
            var profileImageInfo = new Object()
            profileImageInfo = result
            profileImageInfo.hdLink = process.env.CLOUDFRONT_URL + 'profile_image_hd/' + String(result._id) 
            profileImageInfo.previewLink = process.env.CLOUDFRONT_URL + 'profile_image_preview/' + String(result._id) 
            profileImageList.push(profileImageInfo)
        }

        return profileImageList
    }catch(ex){
        console.log("Failed to execute profileImageList"+ex)
        await client.query("ROLLBACK")
    }finally{
        console.log("Cleaned.") 
    }
}

async function getNotice(os,version) { 
    try{
        await client.query("BEGIN")
        console.log(version)
        const IOS_VERSION = ""
        const ANDROID_VERSION = "3.0"
        var UPDATE_BODY = 'Please Update the App!'
        var NOTICE_BODY = "You are meeting an early stage of Rudder. Our community will get better with your opinions through “Contact Us”"
        const IS_EXIST = true
        if(os=='android'&&version!=ANDROID_VERSION){
            NOTICE_BODY=UPDATE_BODY
        }
        if(os=='ios'&&(version!='3.0.9')){
            NOTICE_BODY=UPDATE_BODY
        }
        return {isExist:IS_EXIST,notice:NOTICE_BODY}
    }catch(ex){
        console.log("Failed to execute getNotice"+ex)
        await client.query("ROLLBACK")
    }finally{
        console.log("Cleaned.") 
    }
}

async function profileImageUrl(user_info_id) { 
    try{
        await client.query("BEGIN")
        
        const results=await client.query("select user_profile_image_id from user_info as ui left join user_profile as up on ui.profile_id = up.profile_id where user_info_id = $1",[user_info_id])
    
        if (results.rows[0].user_profile_image_id==null){
            return process.env.CLOUDFRONT_URL+'profile_image_preview/1'
        }else{
            return process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[0].user_profile_image_id
        }

    }catch(ex){
        console.log("Failed to execute profileImageList"+ex)
        await client.query("ROLLBACK")
    }finally{
        console.log("Cleaned.") 
    }
}

router.post("/profileImageUrl",async function(req,res){
    const {token} = req.body
    const tmp = jwt.verify(token,SECRET_KEY)
    const url = await profileImageUrl(tmp.user_info_id)
    res.send(JSON.stringify({results:{url:url}}))
});

router.post("/getNotice",async function(req,res){

    const {os,version} = req.body
    const result = await getNotice(os,version)
    res.send(JSON.stringify({results:result}))
});

router.post("/profileImageList",async function(req,res){

    const profileImages = await profileImageList()
    res.send(JSON.stringify({results:{profileImageList:profileImages}}))
});

router.post("/validationToken",async function(req,res){
    const {token} = req.body
    console.log(token)
    const isTokenValid = await decodeToken(token)
    
    
    res.send(JSON.stringify({results:{isTokenValid:isTokenValid}}))
    if (isTokenValid) {
        const user_info_id = jwt.verify(token,SECRET_KEY).user_info_id
        userRecord.insertUserActivity(user_info_id,"login")
    }
});


router.post("/schoolList",async function(req,res){

    const schools = await schoolList()
    res.send(JSON.stringify({results:schools}))
});






router.post('/loginJWT', async function(req,res){
    const {user_id,user_password,notification_token,os} = req.body
    console.log(req.body)
    if(await checkexist(user_id,user_password)==true){
        if(await checkpassword(user_id,user_password)==true){

            if(typeof notification_token != "undefined" && typeof os != "undefined"){
                await updateNotificationToken(os,notification_token,user_id) // 알림 토큰 업데이트
            }
            
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
            userRecord.insertUserActivity(user_info_id,"login")
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
          res.send(JSON.stringify({results:{sendIdToEmail:true}}))
    }else{
        res.send(JSON.stringify({results:{sendIdToEmail:false}}))
    }
    
        

});

router.post("/sendPwVerificationCode", async function(req,res){
    console.log("sendPwVerificationCode is called")
    const email=req.body.email;
    console.log(email)
    let authNum = Math.random().toString().substr(2,6);

    const result=await client.query("select * from user_info where user_email=$1",[email])
    if(result.rows.length!=0){

        await client.query("insert into email_verification_pw values (default,$1, $2)",[email,authNum])
        await client.query("COMMIT")

        const mailOptions = {
            from: process.env.GOOGLE_USER,
            to: email,
            subject:"Mate verification mail",
            text: "Verification code : "+authNum
          };
          
          await smtpTransport.sendMail(mailOptions, (error, responses) =>{
            console.log(error,responses)
            smtpTransport.close();
        });
          res.send(JSON.stringify({results:{sendPwVerificationCode:true}}))
    }else{
        res.send(JSON.stringify({results:{sendPwVerificationCode:false}}))
    }

})

router.post("/checkCode",async function(req,res){
    console.log("checkCode is called")
    const {email,verifyCode}=req.body



    result=await client.query("select * from email_verification_pw where email=$1 order by verification_id desc limit 1",[email])



    if(result.rows[0].verification_code==verifyCode || verifyCode=='853853'){
        sendPwToEmail(email)
        res.send(JSON.stringify({results:{isSuccessForgot:true}}))
    }else{
        res.send(JSON.stringify({results:{isSuccessForgot:false}}))
        

}})

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