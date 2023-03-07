const express = require("express");
const bodyParser = require("body-parser");
const qrcode = require("qrcode-terminal");
const fetch = (...args) => import('node-fetch').then(({
  default: fetch
  }) => fetch(...args));
  const app = express();

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.post("/hooks", (req, res) => {
    printQR(req);
    handleMsg(req);
  })

  function printQR( {
    body
  }) {
    if (body.qr) qrcode.generate(body.qr, {
      small: true
    }, qr => console.log(qr));
  }

  async function handleMsg( {
    body
  }) {
    let text = (body.conversation ?? body.media.caption) ?? "";
    if (text == "!ping") {
      try {
        let f = await fetch("http://localhost:5000/sendMessage", {
          method: 'post',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apikey: "api1",
            to: '6285174254323@s.whatsapp.net',
            text: 'pong!',
            media: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_ESdpTERlnT1RYpeyQry-yGqrq8h2RfFdTQ&usqp=CAU'
          })
        });
        console.log(await f.json())
      } catch(err) {
        console.log(err);
      }
    }
  }

  app.listen(3000);