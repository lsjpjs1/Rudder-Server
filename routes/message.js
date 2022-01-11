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
      await client.query("insert into post_message values (default,$1,$2,default,$3,default)",[send_user_info_id,receive_user_info_id,messageBody])
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

module.exports = router;