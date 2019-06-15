const WebSocket = require('ws');
const osc = require("osc");

const wss = new WebSocket.Server({ port: 8080 });
// const wekPort = new osc.UDPPort({
//     remoteAddress: "127.0.0.1",
//     remotePort: 6448,
//     metadata: true
// });
// wekPort.open();
const outPort = new osc.UDPPort({
    remoteAddress: "127.0.0.1",
    remotePort: 7000,
    metadata: true
});
outPort.open();

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
//     wekPort.send({
//        address: "/wek/inputs",
//        args: [
//            {
//                type: "f",
//                value: message
//            }
//        ]
//    });
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
