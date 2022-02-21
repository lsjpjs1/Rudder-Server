const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");
const userRecord = require("./userrecord")
const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle");
const notification = require("./notification")
const request = require('request')

async function commentRender(post_id, user_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("select left_join_res.*,bcl.user_id as like_user_id from \
        (SELECT bcn.*,ui.user_nickname,ui.user_profile_image_id,ui.user_info_id from board_comment as bcn left join (select * from user_info as aa left join user_profile as bb on aa.profile_id = bb.profile_id ) as ui on bcn.user_id = ui.user_id where post_id = $1) as left_join_res \
        left join (select * from board_comment_like where user_id = $2) as bcl on left_join_res.comment_id = bcl.comment_id \
        where is_delete=false order by group_num,order_in_group",[post_id,user_id])
        var comments = new Array()
        for(var i=0;i<results.rows.length;i++){
            var currentComment  = new Object()
            if(results.rows[i].user_nickname==null){
                currentComment.user_id = results.rows[i].user_id.substr(0,1)+'******'
            }else{
                currentComment.user_id = results.rows[i].user_nickname.substr(0,1)+'******'
                if (results.rows[i].user_nickname == "Rudder"){
                    currentComment.user_id = "Rudder"
                }
            }
            currentComment.comment_id = results.rows[i].comment_id
            currentComment.comment_body = results.rows[i].comment_body
            currentComment.post_time = results.rows[i].post_time
            currentComment.like_count =results.rows[i].like_count
            currentComment.user_info_id = results.rows[i].user_info_id

            currentComment.status =results.rows[i].status
            currentComment.order_in_group=results.rows[i].order_in_group
            currentComment.group_num=results.rows[i].group_num
            currentComment.is_delete = results.rows[i].is_delete
            currentComment.isMine=false
            if(user_id==results.rows[i].user_id)currentComment.isMine=true
            currentComment.isLiked=false
            if(user_id==results.rows[i].like_user_id)currentComment.isLiked=true

            
            currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[i].user_profile_image_id != null){
                currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[i].user_profile_image_id
            }
            if (currentComment.user_id == "Rudder"){
                currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
            }


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
        var queryResult
        var os
        var notification_token
        var insertResult
        var commentTime
        if(status=="parent"){
            queryResult = await client.query("select count(c.count), \
            (select notification_token from user_info where user_id = (select user_id from board where post_id = $1 )), \
            (select user_info_id from user_info where user_id = (select user_id from board where post_id = $1 )), \
            (select os from user_info where user_id = (select user_id from board where post_id = $1 )) from (SELECT count(comment_id) \
            from board_comment where post_id = $1 group by group_num) as c",[post_id])
            insertResult = await client.query("insert into board_comment values (default, $1, $2, $3, default, 0,$4,0,$5) returning *",[post_id,user_id,comment_body,status,queryResult.rows[0].count])
            await notification.saveNotificationInfo(1,queryResult.rows[0].user_info_id,insertResult.rows[0].comment_id)
        }else{
            queryResult= await client.query("\
            select count(c.count), \
            (select notification_token from user_info where user_id = (select user_id from board_comment where post_id = $1 and group_num=$2 and order_in_group=0)), \
            (select os from user_info where user_id = (select user_id from board_comment where post_id = $1 and group_num=$2 and order_in_group=0)), \
            (select user_info_id from user_info where user_id = (select user_id from board_comment where post_id = $1 and group_num=$2 and order_in_group=0)) \
            from (SELECT count(comment_id) from board_comment where post_id = $1 and group_num = $2 group by order_in_group) as c",[post_id,group_num])
            insertResult =await client.query("insert into board_comment values (default, $1, $2, $3, default, 0,$4,$5,$6) returning *",[post_id,user_id,comment_body,status,queryResult.rows[0].count,group_num])
            await notification.saveNotificationInfo(3,queryResult.rows[0].user_info_id,insertResult.rows[0].comment_id)
        }
        os = queryResult.rows[0].os
        notification_token = queryResult.rows[0].notification_token
        console.log(queryResult.rows[0])
        
        await notification.notificationFromToken(os,notification_token,comment_body) // undefined check는 notificationFromToken에서 함
        await client.query("update board set comment_count = comment_count+1 where post_id=($1)",[post_id])
        await client.query("COMMIT")
        
    }catch(ex){
        console.log("Failed to execute addComment"+ex)
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
        await client.query("update board_comment set like_count = like_count+$1 where comment_id=($2)",[plusValue,comment_id])
        await client.query("COMMIT")
        const likeCountResult = await client.query("select like_count from board_comment where comment_id=$1",[comment_id])
        return likeCountResult.rows[0].like_count
    }catch(ex){
        console.log("Failed to execute addLikeComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteComment(comment_id, post_id){
    try{
        await client.query("BEGIN")
        await client.query("update board_comment set is_delete=true where comment_id = $1",[comment_id])
        await client.query("update board set comment_count = comment_count-1 where post_id=($1)",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deleteComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function editComment(comment_body,comment_id){
    try{
        await client.query("BEGIN")
        await client.query("update board_comment set comment_body=$1,is_edit=true where comment_id=$2",[comment_body,comment_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute editComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function myComments(user_id,page){
    try{
        const offset = page * 20
        await client.query("BEGIN")
        const results = await client.query("\
        select left_join_res.*,bcl.user_id as like_user_id \
        from \
            (\
                SELECT bcn.*,ui.user_nickname,ui.user_profile_image_id,ui.user_info_id \
                from \
                    board_comment as bcn \
                left join \
                    (select * from user_info as aa left join user_profile as bb on aa.profile_id = bb.profile_id ) as ui \
                on \
                    bcn.user_id = ui.user_id \
                where \
                    ui.user_id = $1\
            ) as left_join_res \
        left join \
            (\
                select * from board_comment_like where user_id = $1\
            ) as bcl \
        on \
            left_join_res.comment_id = bcl.comment_id \
        where \
            is_delete=false order by post_time desc \
        limit 20 \
        offset $2",[user_id,offset])
        var comments = new Array()
        for(var i=0;i<results.rows.length;i++){
            var currentComment  = new Object()
            if(results.rows[i].user_nickname==null){
                currentComment.user_id = results.rows[i].user_id.substr(0,1)+'******'
            }else{
                currentComment.user_id = results.rows[i].user_nickname.substr(0,1)+'******'
                if (results.rows[i].user_nickname == "Rudder"){
                    currentComment.user_id = "Rudder"
                }
            }
            currentComment.comment_id = results.rows[i].comment_id
            currentComment.comment_body = results.rows[i].comment_body
            currentComment.post_time = results.rows[i].post_time
            currentComment.like_count =results.rows[i].like_count
            currentComment.user_info_id = results.rows[i].user_info_id

            currentComment.status =results.rows[i].status
            currentComment.order_in_group=results.rows[i].order_in_group
            currentComment.group_num=results.rows[i].group_num
            currentComment.is_delete = results.rows[i].is_delete
            currentComment.isMine=false
            if(user_id==results.rows[i].user_id)currentComment.isMine=true
            currentComment.isLiked=false
            if(user_id==results.rows[i].like_user_id)currentComment.isLiked=true

            
            currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[i].user_profile_image_id != null){
                currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[i].user_profile_image_id
            }
            if (currentComment.user_id == "Rudder"){
                currentComment.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
            }


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


router.post("/myComments",async function(req,res){
    console.log("myComments is called")
    const {token,page} = req.body; 
    if(tk.decodeToken(token)){
        var decodedToken = jwt.verify(token,SECRET_KEY)
        var comments=await myComments(decodedToken.user_id,page);
        var jsonData=JSON.stringify({results:comments})
        res.send(jsonData);
    }else{
        res.send('error')
    }
})

router.post("/editComment",async function(req,res){
    console.log("editComment is called") 
    const {comment_body,comment_id,token}=req.body
    if(tk.decodeToken(token)){
        await editComment(comment_body,comment_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
        
    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
})

router.post("/deleteComment",async function(req,res){
    console.log("deleteComment is called")
    const {comment_id,post_id} = req.body
    await deleteComment(comment_id,post_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
})

router.post("/addlike",async function(req,res){
    console.log("addlike is called")
    const {comment_id,token,plusValue} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        const like_count = await addLike(temp.user_id,comment_id,plusValue)
        res.send(JSON.stringify({results:{isSuccess:true,like_count:like_count}}))

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
        userRecord.insertUserActivity(temp.user_info_id,"comment")
        
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