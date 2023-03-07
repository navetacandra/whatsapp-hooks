const express = require("express");
const bodyParser = require("body-parser");
const qrcode = require("qrcode-terminal");
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/hooks", (req, res) => {
  //console.log(req.body)
  printQR(req);
})

function printQR({body}) {
  if(!body.qr) return;
  qrcode.generate(body.qr, {small: true}, qr => console.log(qr));
}

app.listen(3001);