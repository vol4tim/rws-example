const Libp2p = require("libp2p");
const Mplex = require("libp2p-mplex");
const { NOISE } = require("libp2p-noise");
const Gossipsub = require("libp2p-gossipsub");
const Websockets = require("libp2p-websockets");
const Bootstrap = require("libp2p-bootstrap");
import config from "../config.json";

const createNode = async (listen) => {
  const node = await Libp2p.create({
    addresses: {
      listen: listen,
    },
    modules: {
      transport: [Websockets],
      streamMuxer: [Mplex],
      connEncryption: [NOISE],
      pubsub: Gossipsub,
      peerDiscovery: [Bootstrap],
    },
    config: {
      peerDiscovery: {
        [Bootstrap.tag]: {
          enabled: true,
          list: [
            "/dns4/1.pubsub.aira.life/tcp/443/wss/ipfs/QmdfQmbmXt6sqjZyowxPUsmvBsgSGQjm4VXrV7WGy62dv8",
            "/dns4/2.pubsub.aira.life/tcp/443/wss/ipfs/QmPTFt7GJ2MfDuVYwJJTULr6EnsQtGVp8ahYn9NSyoxmd9",
            "/dns4/3.pubsub.aira.life/tcp/443/wss/ipfs/QmWZSKTEQQ985mnNzMqhGCrwQ1aTA6sxVsorsycQz9cQrw",
          ],
        },
      },
    },
  });

  await node.start();
  return node;
};

export default async function () {
  const node = await createNode(["/ip4/0.0.0.0/tcp/10333/ws"]);

  console.log(new Date().toLocaleString(), "[Pubsub]", "Ready");

  console.log(
    new Date().toLocaleString(),
    "[Pubsub]",
    `PeerId ${node.peerId.toB58String()}`
  );

  node.pubsub.on(config.pubsub.topic, (msg) => {
    try {
      const data = JSON.parse(msg.data.toString());
      if (data.time && data.id === config.pubsub.device_id) {
        console.log(
          new Date().toLocaleString(),
          "[Pubsub]",
          msg.data.toString()
        );
      }
    } catch (e) {
      console.log(new Date().toLocaleString(), "[Pubsub]", e.messge);
    }
  });
  await node.pubsub.subscribe(config.pubsub.topic);

  const worker = () => {
    node.pubsub.publish(
      config.pubsub.topic,
      Buffer.from(
        JSON.stringify({
          time: Date.now(),
          id: config.pubsub.device_id,
          type: "iot",
        })
      )
    );
  };
  worker();
  setInterval(worker, config.pubsub.timeout);
}
