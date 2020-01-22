const cors = require('cors');
const express = require('express');
const fs = require('fs');
const osc = require('osc');
const WebSocket = require('ws');

const HTTP_PORT = 3000;
const WEBSOCKET_PORT = 8080;
const IMAGE_DIR = 'images';

const app = express();
app.use(cors());
app.use('/images', express.static(IMAGE_DIR));

app.get('/images', (req, res) => {
  const items = fs.readdirSync(IMAGE_DIR).filter(name => !/^\./.test(name));
  console.log('Sending image list:', JSON.stringify(items));
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(items));
});

app.listen(HTTP_PORT, () =>
  console.info(`API Server running at http://localhost:${HTTP_PORT}`)
);

/*
 * WebSocket and OSC connections
 */
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
console.log('Websocket server running at ws://localhost:%s', wss.options.port);

const oscPorts = [
  {
    options: {
      remoteAddress: '127.0.0.1',
      localPort: 57122,
      remotePort: 6448,
      metadata: true,
    },
    address: '/wek/inputs',
  },
  {
    options: {
      remoteAddress: '127.0.0.1',
      remotePort: 7000,
      metadata: true,
    },
    address: '/pose/outputs',
  },
].map(({ options, address }) => ({
  port: new osc.UDPPort(options),
  address: address,
}));

let openOscPorts = () => {
  oscPorts.forEach(({ port }) => {
    console.log(
      'Relaying data to osc://%s:%d',
      port.options.remoteAddress,
      port.options.remotePort
    );
    port.open();
  });
  openOscPorts = () => {};
};

wss.on('connection', ws => {
  ws.on('message', message => {
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
