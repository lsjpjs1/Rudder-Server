var express = require('express');
var request = require('request')
var router = express.Router();
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./apple-app-site-association", "utf8"));
/* GET home page. */
router.get('/', function(req, res, next) {
  res.writeHead(301, {
    Location: 'https://rudderpre.notion.site/rudderpre/54f8bd8a6f31416f9fcb94183e4be6f3'
  }).end();
});

/* GET home page. */
router.get('/apple-app-site-association', function(req, res, next) {
  res.json(data);
});

/* GET home page. */
router.get('/deeplink', function(req, res, next) {
  
    

    res.redirect("https://onelink.to/rudder")

    
});

module.exports = router;
