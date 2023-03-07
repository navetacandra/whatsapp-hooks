const makeWASocket = require('@adiwajshing/baileys').default
const {
  BufferJSON,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@adiwajshing/baileys');
const fs = require('fs');
const fileTypeFromBuffer = (...args) => import('file-type').then(({
  fileTypeFromBuffer
}) => fileTypeFromBuffer(...args));
const fetch = (...args) => import('node-fetch').then(({
  default: fetch
  }) => fetch(...args));
  const express = require('express');
  const bodyParser = require('body-parser');

  const app = express();
  const API = JSON.parse(fs.readFileSync("api.json", "utf-8"));
  const socks = {};

  async function connectToWhatsApp (key) {
    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(API[key].name)
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    socks[key] = sock;

    // this will be called as soon as the credentials are updated
    sock.ev.on ('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const {
        connection, lastDisconnect, qr
      } = update

      if ("qr" in update && (qr != null || typeof qr != "undefined")) {
        try {
          await fetch(API[key].url, {
            method: 'post',
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              qr
            })
          });
        } catch (e) {
          console.log("[ERROR]", e.code, API[key].url);
        }
      }

      if (connection === 'close') {
        if (typeof lastDisconnect !== 'undefined' && lastDisconnect !== null) {
          const shouldReconnect = typeof lastDisconnect !== 'undefined' && typeof lastDisconnect.error !== 'undefined' && typeof lastDisconnect.error.output !== 'undefined' && typeof lastDisconnect.error.output.statusCode !== 'undefined' && lastDisconnect.error.output.statusCode != DisconnectReason.loggedOut
          if (shouldReconnect) {
            connectToWhatsApp(key)
          }
        }
      } else if (connection === 'open') {
        console.log('opened connection')
      }
    })
    sock.ev.on('messages.upsert',
      async ({
        messages
      }) => {
        let m = messages[0]
        if (m.key.fromMe) return;
        if (!m.message) return;

        let messageType = Object.keys (m.message)[0];

        let data = {
          from: m.key.remoteJid,
          id: m.key.id,
          timestamp: m.messageTimestamp,
          messageType: messageType,
          hasMedia: false,
        };

        if (messageType == 'conversation') {
          data.conversation = m.message.conversation;
        }
        if ('viewOnceMessageV2' in m.message && m.message.viewOnceMessageV2 != null) {
          data.viewOnceMessage = true;
          m = m.message.viewOnceMessageV2;
          data.messageType = Object.keys (m.message)[0];
        }
        if (messageType != 'conversation') {
          let mDetail = m.message[data.messageType];

          data.hasMedia = true;
          data['media'] = {};

          if ('mimetype' in mDetail && mDetail.mimetype != null) {
            data['media'].mimetype = mDetail.mimetype;
          }
          if ('filename' in mDetail && mDetail.filename != null) {
            data['media'].filename = mDetail.filename;
          }
          if ('caption' in mDetail && mDetail.caption != null) {
            data['media'].caption = mDetail.caption;
          }
          data['media'].data = (await downloadMediaMessage(m, 'buffer')).toString("base64");
        }

        try {
          await fetch(API[key].url, {
            headers: {
              'Content-Type': 'application/json'
            },
            method: 'post',
            body: JSON.stringify(data)
          });
        } catch(e) {
          console.log("[ERROR]", e.code, API[key].url);
        }
      });
  }

  (async () => {
    let keys = Object.keys(API);
    for (let i = 0; i < keys.length; i++) {
      connectToWhatsApp(keys[i]);
    }
  })();

  app.use(bodyParser.json());

  app.post("/sendMessage", async (req, res) => {
    const {
      apikey,
      to,
      text,
      media,
      options
    } = req.body;
    if (!apikey) {
      return res.status(403).json({
        "code": 403,
        "message": "Access denied."
      });
    }
    if (!to || !(text || media)) {
      return res.status(400).json({
        "code": 400,
        "message": "Parameter not completed."
      });
    }

    if (!Object.keys(socks).includes(apikey)) {
      return res.status(403).json({
        "code": 403,
        "message": "APIKEY not found."
      });
    }

    if (!media) {
      try {
        await socks[apikey].sendMessage(to, {
          text
        });
        return res.status(200).json({
          "code": 200
        });
      } catch(err) {
        return res.status(500).json({
          "code": 500,
          "message": err
        });
      }
    }
    if (media) {
      try {
        let fileDetails = {},
        _file;
        if (typeof media == "buffer") {
          _file = media;
          fileDetails = await fileTypeFromBuffer(media);
        }
        if (typeof media == "string" && media.startsWith("http")) {
          _file = await (await fetch(media)).buffer();
          fileDetails = await fileTypeFromBuffer(_file);
        }
        if (typeof media == "string" && !media.startsWith("http")) {
          _file = new Buffer.from(media, 'base64');
          fileDetails = await fileTypeFromBuffer(_file);
        }
        console.log(fileDetails);
        console.log(_file);
        await socks[apikey].sendMessage(to, {
          caption: text, image: media
        });
        return res.status(200).json({
          "code": 200
        });
      } catch(err) {
        console.log(err)
        return res.status(500).json({
          "code": 500,
          "message": err
        });
      }
    }
  })

  app.listen(5000, console.log('Running'));