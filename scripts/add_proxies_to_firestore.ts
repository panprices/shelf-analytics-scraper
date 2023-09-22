/**
 * Add proxies to firestore "proxy_status" document,
 * so that we can keep track of the state of the proxies.
 */

import { getFirestore } from "firebase-admin/firestore";

import { initializeApp, applicationDefault } from "firebase-admin/app";

initializeApp({
  credential: applicationDefault(),
});

const ips = [
  "185.228.18.101",
  "185.228.18.103",
  "185.228.18.114",
  "185.228.18.116",
  "185.228.18.118",
  "185.228.18.131",
  "185.228.18.133",
  "185.228.18.135",
  "185.228.18.146",
  "185.228.18.148",
  "185.228.18.150",
  "185.228.18.163",
  "185.228.18.165",
  "185.228.18.167",
  "185.228.18.178",
  "185.228.18.18",
  "185.228.18.180",
  "185.228.18.182",
  "185.228.18.195",
  "185.228.18.197",
  "185.228.18.199",
  "185.228.18.20",
  "185.228.18.210",
  "185.228.18.212",
  "185.228.18.214",
  "185.228.18.22",
  "185.228.18.227",
  "185.228.18.229",
  "185.228.18.231",
  "185.228.18.24",
  "185.228.18.242",
  "185.228.18.244",
  "185.228.18.246",
  "185.228.18.248",
  "185.228.18.3",
  "185.228.18.35",
  "185.228.18.37",
  "185.228.18.39",
  "185.228.18.5",
  "185.228.18.50",
  "185.228.18.52",
  "185.228.18.54",
  "185.228.18.67",
  "185.228.18.69",
  "185.228.18.7",
  "185.228.18.71",
  "185.228.18.82",
  "185.228.18.84",
  "185.228.18.86",
  "185.228.18.99",
];

async function addIpAddresses(ipList: string[]) {
  const db = getFirestore();
  const ipsCollection = db.collection("proxy_status"); // Assuming you want to name your collection 'ipAddresses'

  for (const ip of ipList) {
    const documentData = {
      country: "DE",
      ip: ip,
      last_burned: new Date(2023, 0, 1),
      last_used: new Date(),
    };

    console.log(`Adding IP: ${JSON.stringify(documentData)}`);

    // Uncomment the lines below to write to firestore:
    // await ipsCollection
    //   .doc(ip)
    //   .set(documentData)
    //   .then((_ref) => {
    //     console.log(`Added IP address with ID: ${ip}`);
    //   })
    //   .catch((error) => {
    //     console.error(`Error adding IP address: ${error}`);
    //   });
  }

  console.log("Done.");
}

await addIpAddresses(ips);
