const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle");

async function commentRender(post_id, user_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("select left_join_res.*,bcl.user_id as like_user_id from (SELECT bcn.*,ui.user_nickname from board_comment_new as bcn left join user_info as ui on bcn.user_id = ui.user_id where post_id = $1) as left_join_res left join (select * from board_comment_like where user_id = $2) as bcl on left_join_res.comment_id = bcl.comment_id  order by group_num,order_in_group",[post_id,user_id])
        var comments = new Array()
        for(var i=0;i<results.rows.length;i++){
            var currentComment  = new Object()
            if(results.rows[i].user_nickname==null){
                currentComment.user_id = results.rows[i].user_id
            }else{
                currentComment.user_id = results.rows[i].user_nickname
            }
            currentComment.comment_id = results.rows[i].comment_id
            currentComment.comment_body = results.rows[i].comment_body
            currentComment.post_time = results.rows[i].post_time
            currentComment.like_count =results.rows[i].like_count

            currentComment.status =results.rows[i].status
            currentComment.order_in_group=results.rows[i].order_in_group
            currentComment.group_num=results.rows[i].group_num

            currentComment.isMine=false
            if(user_id==results.rows[i].user_id)currentComment.isMine=true
            currentComment.isLiked=false
            if(user_id==results.rows[i].like_user_id)currentComment.isLiked=true
            comments.push(currentComment)
        }
        return comments;
    }catch(ex){
        console.log("Failed to execute commentRender"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addComment(user_id,post_id, comment_body,status,group_num){
    try{
        await client.query("BEGIN")
        if(status=="parent"){
            const groupNumResult = await client.query("select count(c.count) from (SELECT count(comment_id) from board_comment_new where post_id = $1 group by group_num) as c",[post_id])
            await client.query("insert into board_comment_new values (default, $1, $2, $3, default, 0,$4,0,$5)",[post_id,user_id,comment_body,status,groupNumResult.rows[0].count])
        }else{
            const orderInGroupResult = await client.query("select count(c.count) from (SELECT count(comment_id) from board_comment_new where post_id = $1 and group_num = $2 group by order_in_group) as c",[post_id,group_num])
            await client.query("insert into board_comment_new values (default, $1, $2, $3, default, 0,$4,$5,$6)",[post_id,user_id,comment_body,status,orderInGroupResult.rows[0].count,group_num])
        }
        await client.query("update board set comment_count = comment_count+1 where post_id=($1)",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLike"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addLike(user_id,comment_id,plusValue=1){
    try{
        await client.query("BEGIN")
        if(plusValue==1){
            await client.query("insert into board_comment_like values ($1, $2)",[comment_id,user_id])
        }else{
            await client.query("delete from board_comment_like where comment_id=$1 and user_id=$2",[comment_id,user_id])
        }
        await client.query("update board_comment_new set like_count = like_count+$1 where comment_id=($2)",[plusValue,comment_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLikeComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/addlike",async function(req,res){
    console.log("addlike is called")
    const {comment_id,token,plusValue} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addLike(temp.user_id,comment_id,plusValue).then(res.send(JSON.stringify({results:{isSuccess:true}})));
        

    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
    
})

router.post("/addComment",async function(req,res){
    console.log("addComment is called")
    //일반 댓글일 경우 group_num  -> -1로 request, 대댓글일 경우 부모 댓글의 group_num
    const {post_id,comment_body,token,status,group_num} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addComment(temp.user_id,post_id, comment_body,status,group_num).then(res.send(JSON.stringify({results:{isSuccess:true}})))
        
    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
})

router.post("/showComment",async function(req,res){
    console.log("showComment is called")
    const {post_id,token} = req.body; 
    if(tk.decodeToken(token)){
        var decodedToken = jwt.verify(token,SECRET_KEY)
        var comments=await commentRender(post_id,decodedToken.user_id);
        var jsonData=JSON.stringify({results:comments})
        res.send(jsonData);
    }else{
        res.send('error')
    }
})



module.exports = router;