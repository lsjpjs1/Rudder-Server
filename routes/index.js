var express = require('express');
var request = require('request')
var router = express.Router();
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./apple-app-site-association", "utf8"));
/* GET home page. */
// router.get('/', function(req, res, next) {
//   res.writeHead(301, {
//     Location: 'https://seasoned-industry-d2e.notion.site/Hello-Students-b514e16c03d84d43acb04caa9d4fe450'
//   }).end();
// });

/* GET home page. */
router.get('/apple-app-site-association', function(req, res, next) {
  res.json(data);
});

/* GET home page. */
router.get('/deeplink', function(req, res, next) {
  
    
  
  const options = {
    uri:'https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyCgd8viedlq1eKhBVUFqGSRVqYPyo6aVWc', 
    method: 'POST',
    json:true,
    body: {
      "dynamicLinkInfo": {
        "domainUriPrefix": "https://teamswan.page.link",
        "link": "https://teamswan.page.link/main/?jobId=78"
      }
    }
  }
  request.post(options, function(err,httpResponse,body){ 
    console.log(body)
    res.redirect(body.shortLink)
  })
    
});

module.exports = router;
