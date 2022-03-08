require('dotenv').config({ path: './.env' });
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ = 'Asia/Tokyo'
const request = require('request')
const apn = require('apn')
var express = require('express');
const client = require('./database');
var router = express.Router();

function getNotificationTitle(notificationType) {
    if (notificationType == 1){
        return "New comment at your post!"
    } else if (notificationType == 2) {
        return "New quick mail!"
    } else if (notificationType == 3){
        return "New comment at your comment!"
    }
}

const notificationFromToken = async function (os, notification_token,notification_message,notificationType,payload) {
    const title = getNotificationTitle(notificationType)
    if (typeof os != "undefined" && typeof notification_token != "undefined") {
        console.log(__dirname.toString())
        var production

        if (process.env.DB_HOST == "rudder-test.cr2cm6ddpemq.ap-northeast-2.rds.amazonaws.com"){
            production = false
        } else {
            production = true
        }
        console.log(production)
        if (os == 'ios') {
            var option = {
                token: {
                    key: __dirname+process.env.ANS_KEY_FILE_PATH,
                    keyId: process.env.APN_KEY_ID,
                    teamId: process.env.APN_TEAM_ID
                },
                production: production
            };
            let apn_provider = new apn.Provider(option)
            // 앱에서 APNs에 앱을 등록하고, 얻은 값.
            let deviceToken = notification_token;
            // 보낼 데이터를 만들어 줍니다.
            var note = new apn.Notification();
            // 보내기 실패할 경우 언제까지 재시돌 할 것인지 여부.
            note.expiry = Math.floor(Date.now() / 1000) + 3600;
            // 앱의 아이콘에 표시될 숫자. ( 우리가 흔히 몇 개의 메시지가 있다고 인식하는 )
            note.badge = 3;
            // 메시지가 도착했을 때 나는 소리.
            note.sound = "ping.aiff";
            // 메시지 내용.
            note.alert = notification_message;
            // 누가 보냈는지 여부.
            // note.payload =  JSON.stringify(payload);
            note.payload =  {"minho":"park"};
            // ios app 번들 명.
            note.topic = process.env.IOS_APP_BUNDLE_NAME;
            // 실제 메시지를 보내도록 합니다.
            apn_provider.send(note, deviceToken).then(function (result) {
                console.log("결과 : " + result.failed[0].response.reason);
                console.log(result);
            }).catch(function (err) {
                throw (err);
            });
        } else if (os == 'android') {
            try{
                
                payload.title = title
                payload.body = notification_message
                const options = {
                    uri:'https://fcm.googleapis.com/fcm/send', 
                    method: 'POST',
                    headers: {
                        "content-type": "application/json",
                        "Authorization": "key= "+process.env.FIREBASE_ANDROID_CLOUD_MESSAGE_KEY
                    },
                    json: {
                        'to': notification_token,
                        'data': payload
                    }
                    }
                request.post(options, function(err,httpResponse,body){ 
                    console.log('err:',err)
                 })
                
                
            }catch(ex){
                console.log("Failed to execute newCommentNotification"+ex)
            }finally{
               // await client.end()
                console.log("Cleaned.") 
            }
        }
    }
}


const saveNotificationInfo = async function(notificationType,user_info_id,commentId,postMessageId){
    try {
        await client.query("BEGIN")
    var baseQuery
     // 1 댓글, 2 쪽지, 3 대댓글
    if (notificationType==1){
        baseQuery = "insert into notification values (default,$3,default,$1,null,$2)"
        await client.query(baseQuery,[commentId,user_info_id,notificationType])
    } else if (notificationType==2) {
        baseQuery = "insert into notification values (default,$3,default,null,$1,$2)"
        await client.query(baseQuery,[postMessageId,user_info_id,notificationType])
    } else if (notificationType==3) {
        baseQuery = "insert into notification values (default,$3,default,$1,null,$2)"
        await client.query(baseQuery,[commentId,user_info_id,notificationType])
    }
    await client.query("COMMIT")
    } catch (error) {
        console.log("Failed to execute saveNotificationInfo"+error)
    }
    
}




module.exports = {
    notificationFromToken,
    saveNotificationInfo,
}



