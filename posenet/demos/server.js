const WebSocket = require('ws');
const osc = require("osc");

const wss = new WebSocket.Server({ port: 8080 });
const oscPort = new osc.UDPPort({
    remoteAddress: "127.0.0.1",
    remotePort: 6448,
    metadata: true
});
oscPort.open();

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    oscPort.send({
       address: "/wek/inputs",
       args: [
           {
               type: "f",
               value: 440
           }
       ]
   });
  });


});
