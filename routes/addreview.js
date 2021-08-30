const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')

const tk = require("./tokenhandle")


function pad(num,size){
    num=num.toString();
    while(num.length<size)num="0"+num;
    return num;
}




async function addreview(name,course_id,reviewbody,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore){
    try{
       
        await client.query("BEGIN")
        const temp=await client.query("select * from user_info where user_id = $1",[name])
        const user_info_id=temp.rows[0].user_info_id
        await client.query("insert into review values (default,$1, $2, $3, default,$4,$5,$6,$7,$8,$9)",[user_info_id,course_id,reviewbody,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore,overallScore])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addreview "+ex)
        await client.query("ROLLBACK")
    }finally{

        console.log("Cleaned.") 
    }
}

async function editReview(name,course_id,reviewbody,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore,review_id){
    try{

        await client.query("BEGIN")
        const temp=await client.query("select * from user_info where user_id = $1",[name])
        const user_info_id=temp.rows[0].user_info_id
        await client.query("update review set user_id=$1, review_content= $2, assignment_score=$3,lecture_difficulty_score=$4,exam_score=$5,grade_ease_score=$6,satisfaction_score=$7,overall_score=$8 where review_id=$9",[user_info_id,reviewbody,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore,overallScore,review_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addreview "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteReview(review_id){
    try{

        await client.query("BEGIN")
        await client.query("delete from review where review_id = $1",[review_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addreview "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/",async function(req,res){
    console.log("addreview is called")
    const reviewbody=req.body.reviewbody;
    const course_id=req.body.course_id;
    const token=req.body.token;
    const {overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore}=req.body

    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        await addreview(decodeTokenJson.user_id,course_id,reviewbody,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore).then(res.send(""))
        
    }else{
        res.send('error')
    }


})

router.post("/addreviewsignup",async function(req,res){
    console.log("addreview is called")
    const reviewbody=req.body.reviewbody;
    const course_id=req.body.course_id;
    var {user_id,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore,user_google_email}=req.body

    if(user_id==null){
        user_id=user_google_email
    }


        await addreview(user_id,course_id,reviewbody,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore).then(res.send(""))
        


})

router.post("/editReview",async function(req,res){
    console.log("editReview is called")
    const reviewbody=req.body.reviewbody;
    const review_id=req.body.review_id;
    const course_id=req.body.course_id;
    const token=req.body.token;
    const {overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore}=req.body
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        await editReview(decodeTokenJson.user_id,course_id,reviewbody,overallScore,assignmentScore,difficultyScore,examScore,easeScore,satisfactionScore,review_id).then(res.send(""))
        
    }else{
        res.send('error')
    }


})

router.post("/deleteReview",async function(req,res){
    console.log("deleteReview is called")
    const review_id=req.body.review_id;
    const token=req.body.token;
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        await deleteReview(review_id).then(res.send(""))
        
    }else{
        res.send('error')
    }


})

module.exports = router;
