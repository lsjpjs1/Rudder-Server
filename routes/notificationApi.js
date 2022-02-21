require('dotenv').config({ path: './.env' });
const SECRET_KEY = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')
process.env.TZ = 'Asia/Tokyo'
const request = require('request')
const apn = require('apn')
var express = require('express');
const client = require('./database');
var router = express.Router();
const tk = require("./tokenhandle");

async function getNotifications(user_info_id){
    try{
      await client.query("BEGIN")
      const results = await client.query("\
      select * \
        from notification \
        left join board_comment as bc on bc.comment_id = notification.comment_id \
        left join post_message as pm on pm.post_message_id = notification.post_message_id \
        where notification.user_info_id = $1 \
        order by notification_id desc",[user_info_id])
      var notifications = new Array()
      for(result of results.rows){
          var notification = new Object()
          notification.notificationId = result.notification_id
          notification.notificationType = result.notification_type
          if(result.notification_type == 1 || result.notification_type == 3){ // 댓글이나 대댓글인 경우
            notification.itemId = result.post_id
            notification.itemBody = result.comment_body
            notification.itemTime = result.post_time
          } else if(result.notification_type == 2){ //메시지인 경우
            notification.itemId = result.post_message_room_id
            notification.itemBody = result.post_message_body
            notification.itemTime = result.message_send_time
          }
          notifications.push(notification)
      }
      return notifications

    }catch(ex){
        console.log("Failed to execute getNotifications"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }

  router.post("/getNotifications",async function(req,res){
  
    
    const {token} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const notifications = await getNotifications(tmp.user_info_id)
      if (notifications){
        res.send(JSON.stringify({results:{isSuccess:true,error:'',notifications:notifications}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database',notifications:[]}}))
      }
      
      
      
    }
  });

  module.exports = 
    router