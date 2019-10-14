const cors = require('cors');
const express = require('express');
const fs = require('fs');
const osc = require('osc');
const WebSocket = require('ws');

const IMAGE_DIR = 'circus images and video';

const app = express();
app.use(cors());
app.use(express.static(IMAGE_DIR));

app.get('/', (req, res) => {
  const items = fs.readdirSync(IMAGE_DIR);
  console.log('Sending image list:', JSON.stringify(items));
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(items));
});

app.listen(3000);

/*
 * WebSocket and OSC connections
 */
const wss = new WebSocket.Server({ port: 8080 });
console.log(`Websocket server running at http://localhost:${wss.options.port}`);

const oscPorts = [
  {
    port: new osc.UDPPort({
      remoteAddress: '127.0.0.1',
      localPort: 57122,
      remotePort: 6448,
      metadata: true,
    }),
    address: '/wek/inputs',
  },
  {
    port: new osc.UDPPort({
      remoteAddress: '127.0.0.1',
      remotePort: 7000,
      metadata: true,
    }),
    address: '/pose/outputs',
  },
];

let openOscPorts = () => {
  oscPorts.forEach(({ port }) => {
    console.log(`Relaying data to osc://${port.options.remoteAddress}:${port.options.remotePort}`);
    port.open();
  });
  openOscPorts = () => { };
};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log('Websocket received: %s', message);
    openOscPorts();
    oscPorts.forEach(({ port, address }) =>
      port.send({
        address,
        args: [{ type: 'f', value: message }],
      })
    );
  });
});
