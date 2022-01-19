var express = require('express');
var router = express.Router();
const tk = require("./tokenhandle");
const jwt = require('jsonwebtoken')
const SECRET_KEY = process.env.JWT_SECRET
const client = require("./database");
const notification = require("./notification")

async function sendPostMessage(send_user_info_id,receive_user_info_id,messageBody){
    try{
      await client.query("BEGIN")
      const post_message_room = await client.query("\
      insert into post_message_room \
      select where not exists (SELECT * from post_message_room_member pmrm1 \
        left join post_message_room_member pmrm2 on \
        pmrm1.post_message_room_id = pmrm2.post_message_room_id \
        where (pmrm1.user_info_id = $1 and pmrm2.user_info_id = $2) or (pmrm1.user_info_id = $2 and pmrm2.user_info_id = $1) ) returning *",[send_user_info_id,receive_user_info_id])

      var post_message_room_id

      if(typeof post_message_room.rows[0] != "undefined"){
        console.log("hit1")
        post_message_room_id = post_message_room.rows[0].post_message_room_id
        
        await client.query("insert into post_message_room_member values (default,$1,$2)",[post_message_room.rows[0].post_message_room_id,send_user_info_id])
        await client.query("insert into post_message_room_member values (default,$1,$2)",[post_message_room.rows[0].post_message_room_id,receive_user_info_id])
      }else{
        console.log("hit2")
        const res= await client.query("SELECT * from post_message_room_member pmrm1 \
        left join post_message_room_member pmrm2 on \
        pmrm1.post_message_room_id = pmrm2.post_message_room_id \
        where (pmrm1.user_info_id = $1 and pmrm2.user_info_id = $2) or (pmrm1.user_info_id = $2 and pmrm2.user_info_id = $1)",[send_user_info_id,receive_user_info_id])
        console.log(res.rows[0].post_message_room_id)
        post_message_room_id = res.rows[0].post_message_room_id
        
      }
      
      await client.query("insert into post_message values (default,$1,$2,default,$3,default,$4)",[send_user_info_id,receive_user_info_id,messageBody,post_message_room_id])
      await client.query("COMMIT")
      const result = await client.query("select * from user_info where user_info_id = $1",[receive_user_info_id])
      const os = result.rows[0].os
      const notification_token = result.rows[0].notification_token
      await notification.notificationFromToken(os,notification_token,"New message!")
      return true
    }catch(ex){
        console.log("Failed to execute sendPostMessage"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }
  
  router.post("/sendPostMessage",async function(req,res){
  
    
    const {token,receiveUserInfoId,messageBody} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const result = await sendPostMessage(tmp.user_info_id,receiveUserInfoId,messageBody)
      if (result){
        res.send(JSON.stringify({results:{isSuccess:true,error:''}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database'}}))
      }
      
      
      
    }
  });

  async function updateIsRead(postMessageId){
    try{
        console.log(postMessageId)
      await client.query("BEGIN")
      await client.query("update post_message set is_read = true where post_message_id = $1",[postMessageId])
      await client.query("COMMIT")
      return true
    }catch(ex){
        console.log("Failed to execute updateIsRead"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }
  
  router.post("/updateIsRead",async function(req,res){
  
    
    const {token,postMessageId} = req.body
    if(tk.decodeToken(token)){
      const result = await updateIsRead(postMessageId)
      if (result){
        res.send(JSON.stringify({results:{isSuccess:true,error:''}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database'}}))
      }
      
      
      
    }
  });

  async function getMyMessages(user_info_id){
    try{
      await client.query("BEGIN")
      const results = await client.query("\
        select msg.*, receive_ui.user_nickname as receive_user_nickname, send_ui.user_nickname as send_user_nickname \
        from post_message msg \
        left join \
          user_info receive_ui \
        on receive_ui.user_info_id = msg.receive_user_info_id \
        left join \
          user_info send_ui \
        on send_ui.user_info_id = msg.send_user_info_id \
        where send_user_info_id = $1 or receive_user_info_id = $1 \
        order by msg.message_send_time desc \
        ",[user_info_id])
      var messages = new Array()
      for(result of results.rows){
          var message = new Object()
          message.receiveUserInfoId = result.receive_user_info_id
          message.sendUserInfoId = result.send_user_info_id
          message.messageBody = result.post_message_body
          message.isRead = result.is_read
          message.messageSendTime = result.message_send_time
          message.postMessageId = result.post_message_id
          message.sendUserNickname = result.send_user_nickname
          message.receiveUserNickname = result.receive_user_nickname

          messages.push(message)
      }
      return messages

    }catch(ex){
        console.log("Failed to execute getMyMessages"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }

  router.post("/getMyMessages",async function(req,res){
  
    
    const {token} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const messages = await getMyMessages(tmp.user_info_id)
      if (messages){
        res.send(JSON.stringify({results:{isSuccess:true,error:'',messages:messages}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database',messages:[]}}))
      }
      
      
      
    }
  });

  

module.exports = router;