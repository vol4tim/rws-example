import polkadot from "./polkadot";
import pubsub from "./pubsub";
import config from "../config.json";

(async function () {
  if (config.polkadot.enable) {
    await polkadot();
  }
  if (config.pubsub.enable) {
    pubsub();
  }
})();
