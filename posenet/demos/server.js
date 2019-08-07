const fs = require('fs');

const express = require('express')
const app = express()

const WebSocket = require('ws');
const osc = require("osc");

app.use(express.static('circus images and video'))

app.get('/', (req, res) => {
    const items = fs.readdirSync("circus images and video");
    console.log(JSON.stringify(items));
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(items))
})
  
app.listen(3000)

const wss = new WebSocket.Server({ port: 8080 });
const wekPort = new osc.UDPPort({
    remoteAddress: "127.0.0.1",
    localPort: 57122,
    remotePort: 6448,
    metadata: true
});
wekPort.open();
const outPort = new osc.UDPPort({
    remoteAddress: "127.0.0.1",
    remotePort: 7000,
    metadata: true
});
outPort.open();

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    wekPort.send({
       address: "/wek/inputs",
       args: [
           {
               type: "f",
               value: message
           }
       ]
   });
   outPort.send({
    address: "/pose/outputs",
    args: [
        {
            type: "f",
            value: message
        }
    ]
    });
  });


});
