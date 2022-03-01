import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { Robonomics, AccountManager } from "robonomics-interface";
import { Keyring } from "@polkadot/keyring";
import config from "../config.json";

async function checkConfig() {
  if (!config.polkadot.sender) {
    const answers = await inquirer.prompt([
      {
        type: "string",
        name: "subscription",
        message: "What is your subscription address.",
        validate: function (input) {
          if (input.trim()) {
            return true;
          }
          return "You need";
        },
      },
      {
        type: "password",
        name: "suri",
        message: "What is your suri account.",
        mask: "*",
        suffix: " (example: //Alice)",
        validate: function (input) {
          if (input.trim()) {
            return true;
          }
          return "You need";
        },
      },
      {
        type: "confirm",
        name: "isSave",
        message: "Save subscription and suri to config file.",
        default: false,
      },
    ]);
    if (!answers.subscription || !answers.suri) {
      return;
    }
    config.polkadot.subscription = answers.subscription;
    config.polkadot.sender = answers.suri;
    if (answers.isSave) {
      fs.writeFileSync(
        path.resolve(__dirname, "config.json"),
        JSON.stringify(config, null, 2)
      );
      console.log(
        new Date().toLocaleString(),
        "[Robonomics]",
        "Save config file"
      );
    }
  }
}

export default async function () {
  await checkConfig();
  const robonomics = new Robonomics({
    endpoint: config.polkadot.chain.endpoint,
    runImmediate: true,
  });
  robonomics.setAccountManager(
    new AccountManager(new Keyring({ type: "sr25519" }))
  );
  robonomics.onReady(() => {
    console.log(new Date().toLocaleString(), "[Robonomics]", "Ready");

    robonomics.accountManager.keyring.addFromUri(config.polkadot.sender);
    const accounts = robonomics.accountManager.getAccounts();
    robonomics.accountManager.selectAccountByAddress(accounts[0].address);

    console.log(
      new Date().toLocaleString(),
      "[Robonomics]",
      `Device ${robonomics.accountManager.account.address}`
    );

    const worker = () => {
      const logFromDevice = `Random: ${Math.random().toFixed(4)}`;
      const call = robonomics.datalog.write(logFromDevice);
      const tx = robonomics.rws.call(config.polkadot.subscription, call);
      robonomics.accountManager
        .signAndSend(tx)
        .then((r) => {
          console.log(
            new Date().toLocaleString(),
            "[Robonomics]",
            `https://robonomics.subscan.io/extrinsic/${r.blockNumber}-${r.txIndex}`
          );
        })
        .catch((error) => {
          console.log(new Date().toLocaleString(), "[Error]", error.message);
        });
    };

    let interval = false;
    robonomics.launch.on({}, (events) => {
      events = events.filter((item) => {
        return item.robot === robonomics.accountManager.account.address;
      });
      for (const event of events) {
        console.log(
          new Date().toLocaleString(),
          "[Robonomics]",
          `New event launch from ${event.account} | parameter ${event.parameter}`
        );
        if (event.parameter) {
          console.log(
            new Date().toLocaleString(),
            "[Robonomics]",
            "Run device"
          );
          clearInterval(interval);
          worker();
          interval = setInterval(worker, config.polkadot.timeout);
        } else {
          console.log(
            new Date().toLocaleString(),
            "[Robonomics]",
            "Stop device"
          );
          clearInterval(interval);
        }
      }
    });
  });
}
