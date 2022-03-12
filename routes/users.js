var express = require('express');
var router = express.Router();
const tk = require("./tokenhandle");
const jwt = require('jsonwebtoken')
const SECRET_KEY = process.env.JWT_SECRET
const client = require("./database");

async function addUserRequest(user_info_id,body){
  try{
    await client.query("BEGIN")
    await client.query("insert into user_request values (default,$1,$2)",[user_info_id,body])
    await client.query("COMMIT")
  }catch(ex){
      console.log("Failed to execute addUserRequest"+ex)
      await client.query("ROLLBACK")
  }finally{
     // await client.end()
      console.log("Cleaned.") 
  }
}

//완료
router.post("/addUserRequest",async function(req,res){

  const {token,request_body} = req.body
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    await addUserRequest(tmp.user_info_id,request_body).then(res.send(JSON.stringify({results:{isSuccess:true}})))
  }
});


async function blockUser(user_info_id,blockUserInfoId){
  try{
    await client.query("BEGIN")
    await client.query("insert into user_block values (default,$1,$2)",[user_info_id,blockUserInfoId])
    await client.query("COMMIT")
  }catch(ex){
      console.log("Failed to execute blockUser"+ex)
      await client.query("ROLLBACK")
  }finally{
     // await client.end()
      console.log("Cleaned.") 
  }
}

//완료
//user가 user 차단하는 api
router.post("/blockUser",async function(req,res){

  const {token,blockUserInfoId} = req.body
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    console.log(tmp)
    await blockUser(tmp.user_info_id,blockUserInfoId)
    res.send(JSON.stringify({results:{isSuccess:true}}))
  }
});

async function updateNickname(user_info_id,nickname){
  try{
    await client.query("BEGIN")
    await client.query("update user_info set user_nickname=$1 where user_info_id=$2",[nickname,user_info_id])
    await client.query("COMMIT")
    return true
  }catch(ex){
      console.log("Failed to execute updateNickname"+ex)
      await client.query("ROLLBACK")
      return false
  }finally{
     // await client.end()
      console.log("Cleaned.") 
  }
}

//완료
router.post("/updateNickname",async function(req,res){

  const {token,nickname} = req.body
  console.log(token)
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    const results = await client.query("select * from user_info where user_nickname=$1",[nickname])
    //닉네임 중복체크
    if(results.rows.length>0){
      res.send(JSON.stringify({results:{isSuccess:false,error:'duplicate'}}))
    }else{
      const result = await updateNickname(tmp.user_info_id,nickname)
      if (result){
        res.send(JSON.stringify({results:{isSuccess:true,error:''}}))
      }else{
        res.send(JSON.stringify({results:{isSuccess:false,error:'database'}}))
      }
    }
    
    
  }
});

async function updateUserProfileImage(user_info_id,profileImageId){
  try{
    await client.query("BEGIN")
    await client.query("update user_profile set user_profile_image_id=$1 where profile_id = (select profile_id from user_info where user_info_id =$2)",[profileImageId,user_info_id])
    await client.query("COMMIT")
    return true
  }catch(ex){
      console.log("Failed to execute updateUserProfileImage"+ex)
      await client.query("ROLLBACK")
      return false
  }finally{
     // await client.end()
      console.log("Cleaned.") 
  }
}

//완료
router.post("/updateUserProfileImage",async function(req,res){

  
  const {token,profileImageId} = req.body
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    const result = await updateUserProfileImage(tmp.user_info_id,profileImageId)
    if (result){
      res.send(JSON.stringify({results:{isSuccess:true,error:''}}))
    }else{
      res.send(JSON.stringify({results:{isSuccess:false,error:'database'}}))
    }
    
    
    
  }
});

module.exports = router;
