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


router.post("/addUserRequest",async function(req,res){

  const {token,request_body} = req.body
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    await addUserRequest(tmp.user_info_id,request_body).then(res.send(JSON.stringify({results:{isSuccess:true}})))
  }
});


async function blockUser(user_info_id,blockUserId){
  try{
    await client.query("BEGIN")
    await client.query("insert into user_block values (default,$1,(select user_info_id from user_info where user_id = $2))",[user_info_id,blockUserId])
    await client.query("COMMIT")
  }catch(ex){
      console.log("Failed to execute blockUser"+ex)
      await client.query("ROLLBACK")
  }finally{
     // await client.end()
      console.log("Cleaned.") 
  }
}


//user가 user 차단하는 api
router.post("/blockUser",async function(req,res){

  const {token,blockUserId} = req.body
  if(tk.decodeToken(token)){
    const tmp = jwt.verify(token,SECRET_KEY)
    console.log(tmp)
    await blockUser(tmp.user_info_id,blockUserId)
    res.send(JSON.stringify({results:{isSuccess:true}}))
  }
});

module.exports = router;
