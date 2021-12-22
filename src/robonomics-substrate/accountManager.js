import { Keyring } from "@polkadot/api";
import { encodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";

const keyring = new Keyring();

class ErrorAccount extends Error {
  constructor(status = null, ...params) {
    super(...params);
    this.status = status;
  }
}

let isReady = false;
export default class AccountManager {
  constructor(config = {}) {
    this.api = null;
    this.config = config;
    this.account = null;
    this.listeners = [];
    isReady = true;
  }
  setAccounts(keys = []) {
    for (const item of keys) {
      let suri;
      let meta = {};
      let type = this.config.type || "sr25519";
      if (item.suri) {
        suri = item.suri;
        if (item.meta) {
          meta = item.meta;
        }
        if (item.type) {
          type = item.type;
        }
      } else {
        suri = item;
      }
      keyring.addFromUri(suri, meta, type);
    }
    if (keys.length) {
      this.selectAccountByAddress(this.getAccounts()[0].address);
    }
  }
  setApi(api) {
    this.api = api;
  }
  static isReady() {
    return isReady;
  }
  onReady(cb) {
    if (isReady) {
      cb();
    } else {
      setTimeout(() => {
        this.onReady(cb);
      }, 1000);
    }
  }
  getAccounts() {
    const pairs = keyring.getPairs();
    return pairs.map((pair) => {
      return {
        ...pair,
        address: encodeAddress(
          pair.address,
          this.config.ss58Format || this.api.registry.chainSS58
        ),
      };
    });
  }
  async selectAccountByAddress(address) {
    const account = keyring.getPair(address);
    this.account = {
      ...account,
      address: encodeAddress(
        account.address,
        this.config.ss58Format || this.api.registry.chainSS58
      ),
    };
    this.account.signMsg = async function (data) {
      return Promise.resolve(u8aToHex(account.sign(data)));
    };
    for (const cb of this.listeners) {
      cb(this.account);
    }
    return this.account;
  }
  onChange(cb) {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      this.listeners.splice(i, 1);
    };
  }
  async signAndSend(tx, options = {}) {
    if (this.account === null) {
      throw new ErrorAccount(3, "No account selected");
    }
    return new Promise((resolve, reject) => {
      tx.signAndSend(
        this.account.meta.isInjected ? this.account.address : this.account,
        options,
        (result) => {
          if (result.status.isInBlock) {
            result.events.forEach(async (events) => {
              const {
                event: { data, method, section },
                phase,
              } = events;
              if (section === "system" && method === "ExtrinsicFailed") {
                let message = "Error";
                if (data[0].isModule) {
                  const mod = data[0].asModule;
                  // const mod = result.dispatchError.asModule;
                  const { docs, name, section } =
                    mod.registry.findMetaError(mod);
                  console.log(name, section, docs);
                  message = docs.join(", ");
                }
                return reject(new ErrorAccount(4, message));
              } else if (
                section === "system" &&
                method === "ExtrinsicSuccess"
              ) {
                const block = await this.api.rpc.chain.getBlock(
                  result.status.asInBlock.toString()
                );
                resolve({
                  block: result.status.asInBlock.toString(),
                  blockNumber: block.block.header.number.toNumber(),
                  // const index = phase.value.toNumber();
                  txIndex: phase.asApplyExtrinsic.toHuman(),
                  tx: tx.hash.toString(),
                });
              }
            });
          }
        }
      ).catch(reject);
    });
  }
}
