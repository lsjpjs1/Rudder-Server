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
      const payload = {}
      await notification.notificationFromToken(os,notification_token,"New message!",payload)
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

  async function getMyMessageRooms(user_info_id){
    try{
      await client.query("BEGIN")
      const results = await client.query("\
      select * \
      from \
        (select distinct on (pmr.post_message_room_id) *,(select user_id from user_info where user_info_id = (select user_info_id from post_message_room_member where post_message_room_id = pmr.post_message_room_id and user_info_id != pmrm.user_info_id) ) as target_user_id,(select user_nickname from user_info where user_info_id = (select user_info_id from post_message_room_member where post_message_room_id = pmr.post_message_room_id and user_info_id != pmrm.user_info_id) ) as target_user_nickname \
        from post_message_room pmr \
        left join post_message_room_member pmrm on pmrm.post_message_room_id = pmr.post_message_room_id \
        left join post_message pm on pm.post_message_room_id = pmr.post_message_room_id \
        where \
        pmrm.user_info_id = $1 \
        order by pmr.post_message_room_id,pm.post_message_id desc \
        ) as res \
      order by res.post_message_id desc ",[user_info_id])
      var rooms = new Array()
      for(result of results.rows){
          var room = new Object()
          room.postMessageRoomId = result.post_message_room_id
          room.messageSendTime = result.message_send_time
          room.postMessageBody = result.post_message_body
          console.log(result)
          room.userId = result.target_user_id.substr(0,1)+'******'
          if (result.target_user_nickname != null){
            room.userId = result.target_user_nickname.substr(0,1)+'******'
          }
          
          


          rooms.push(room)
      }
      return rooms

    }catch(ex){
        console.log("Failed to execute getMyMessageRooms"+ex)
        await client.query("ROLLBACK")
        return false
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
  }

  

  router.post("/getMyMessageRooms",async function(req,res){
  
    
    const {token} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const messages = await getMyMessageRooms(tmp.user_info_id)
      if (messages){
        res.send(JSON.stringify({results:{isSuccess:true,error:'',rooms:messages}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database',rooms:[]}}))
      }
      
      
      
    }
  });





async function getMessagesByRoom(user_info_id,postMessageRoomId){
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

  router.post("/getMessagesByRoom",async function(req,res){
  
    
    const {token,postMessageRoomId} = req.body
    if(tk.decodeToken(token)){
      const tmp = jwt.verify(token,SECRET_KEY)
      const messages = await getMessagesByRoom(tmp.user_info_id,postMessageRoomId)
      if (messages){
        res.send(JSON.stringify({results:{isSuccess:true,error:'',messages:messages}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database',messages:[]}}))
      }
      
      
      
    }
  });

  

module.exports = router;