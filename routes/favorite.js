const express = require('express')
const router = express.Router()
const client = require("./database");
const tk = require("./tokenhandle")
process.env.TZ='Asia/Tokyo'

async function addFavorite(course_id,user_info_id){
    try{
        await client.query("BEGIN")
        await client.query("insert into user_favorite values ($1, $2)",[user_info_id,course_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addFavorite "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteFavorite(course_id,user_info_id){
    try{
        await client.query("BEGIN")
        await client.query("delete from user_favorite where user_info_id = $1 and course_id = $2",[user_info_id,course_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addFavorite "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function isFavorite(course_id,user_info_id){
    try{
        //console.log(tk.testint)
        await client.query("BEGIN")
        const result = await client.query("select * from user_favorite where user_info_id = $1 and course_id = $2",[user_info_id,course_id])
        if(result.rows.length==0){
            return false
        }else{
            return true
        }
    }catch(ex){
        console.log("Failed to execute isFavorite "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/addFavorite",async function(req, res){
    console.log("addFavorite is called")
    const {course_id,token} = req.body
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        await addFavorite(course_id,decodeTokenJson.user_info_id)
        res.send('Add favorite')
    }else{
        res.send('error')
    }
    
    
})

router.post("/deleteFavorite",async function(req, res){
    console.log("deleteFavorite is called")
    const {course_id,token} = req.body
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        await deleteFavorite(course_id,decodeTokenJson.user_info_id)
        res.send('Remove favorite')
    }else{
        res.send('error')
    }
    
    
})

router.post("/isFavorite",async function(req, res){
    console.log("isFavorite is called")
    const {course_id,token} = req.body
    const decodeTokenJson = JSON.parse(await tk.decodeToken(token))
    if(decodeTokenJson.valid){
        if(await isFavorite(course_id,decodeTokenJson.user_info_id)){
            res.send('true')
        }else{
            res.send('false')
        }
        
    }else{
        res.send('error')
    }
    
    
})

module.exports = router;