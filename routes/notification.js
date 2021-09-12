require('dotenv').config({ path: './.env' });
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ = 'Asia/Tokyo'
const request = require('request')
const apn = require('apn')

module.exports.notificationFromToken = async function (os, notification_token,body) {
    if (typeof os != "undefined" && typeof notification_token != "undefined") {
        console.log(__dirname.toString())
        if (os == 'ios') {
            var option = {
                token: {
                    key: __dirname+process.env.ANS_KEY_FILE_PATH,
                    keyId: process.env.APN_KEY_ID,
                    teamId: process.env.APN_TEAM_ID
                },
                production: false
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
            note.alert = body;
            // 누가 보냈는지 여부.
            note.payload = { "messageFrom": "minhoServer" };
            // ios app 번들 명.
            note.topic = process.env.IOS_APP_BUNDLE_NAME;
            // 실제 메시지를 보내도록 합니다.
            apn_provider.send(note, deviceToken).then(function (result) {
                console.log("결과 : " + result);
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
                            'body': body
                            
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

