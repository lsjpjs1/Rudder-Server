require('dotenv').config({ path: './.env' });
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ = 'Asia/Tokyo'
const request = require('request')
const apn = require('apn')
var express = require('express');
const client = require('./database');
var router = express.Router();

const notificationFromToken = async function (os, notification_token,notification_message) {
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
            note.payload = { "messageFrom": "minhoServer" };
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
                
                const options = {
                    uri:'https://fcm.googleapis.com/fcm/send', 
                    method: 'POST',
                    headers: {
                        "content-type": "application/json",
                        "Authorization": "key= "+process.env.FIREBASE_ANDROID_CLOUD_MESSAGE_KEY
                    },
                    json: {
                        'to': notification_token,
                        'notification': {
                            'title': '',
                            'body': notification_message
                            
                        }
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
    if (notificationType=="comment"){
        baseQuery = "insert into notification values (default,1,default,$1,null,$2)"
        await client.query(baseQuery,[commentId,user_info_id])
    } else if (notificationType=="postMessage") {
        baseQuery = "insert into notification values (default,2,default,null,$1,$2)"
        await client.query(baseQuery,[postMessageId,user_info_id])
    }
    await client.query("COMMIT")
    } catch (error) {
        console.log("Failed to execute saveNotificationInfo"+error)
    }
    
}


async function getNotifications(user_info_id,postMessageRoomId){
    try{
      await client.query("BEGIN")
      const results = await client.query("\
      select *, send_user_info_id = $1 as is_sender \
      from post_message \
      where \
      post_message_room_id = $2 \
      order by \
      post_message_id desc ",[user_info_id,postMessageRoomId])
      var messages = new Array()
      for(result of results.rows){
          var message = new Object()
          message.postMessageId = result.post_message_id
          message.sendUserInfoId = result.send_user_info_id
          message.receiveUserInfoId = result.receive_user_info_id
          message.messageSendTime = result.message_send_time
          message.postMessageBody = result.post_message_body
          message.isRead = result.is_read
          message.isSender = result.is_sender
          messages.push(message)
      }
      return messages

    }catch(ex){
        console.log("Failed to execute getMyMessageRooms"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }

  router.post("/getNotifications",async function(req,res){
  
    
    const {token,postMessageRoomId} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const messages = await getNotifications(tmp.user_info_id,postMessageRoomId)
      if (messages){
        res.send(JSON.stringify({results:{isSuccess:true,error:'',messages:messages}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database',messages:[]}}))
      }
      
      
      
    }
  });

module.exports = {
    notificationFromToken,
    router,
    saveNotificationInfo,
}



