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
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  "<PROXY_IP>",
  "<PROXY_IP>",
  "<PROXY_IP>",
  "<PROXY_IP>",
  "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
  // "<PROXY_IP>",
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
      // cookies: {
      //   "wayfair.de": `[{"name":"_pxvid","value":"b9b59f88-5bbe-11ee-849d-463d57f6bfba","domain":"www.wayfair.de","path":"/","expires":1727194522,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"i18nPrefs","value":"lang%3Dde-DE","domain":".wayfair.de","path":"/","expires":1727259687.277516,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"CSNUtId","value":"23f6c71e-6511-b43f-8aaf-472c663a1a02","domain":".wayfair.de","path":"/","expires":1730219071.92865,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"ExCSNUtId","value":"23f6c71e-6511-b43f-8aaf-472c663a1a02","domain":".wayfair.de","path":"/","expires":1730219071.92869,"httpOnly":false,"secure":true,"sameSite":"None"},{"name":"CSN_CSRF","value":"563e8492f39e6d0b6aab263e7c5e61ae24c42e60d657b92df0222884d60c6fc4","domain":".wayfair.de","path":"/","expires":1695745471.92886,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"CSN","value":"g_countryCode%3DDE%26g_zip%3D55595","domain":".wayfair.de","path":"/","expires":1730283687.277621,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"cc_post_exp","value":"1","domain":".wayfair.de","path":"/","expires":1696263872,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"user_cookie_prefs","value":"NECESSARY%2CADMINISTRATIVE%2CPERSONALIZATION%2CANALYTICS%2CADVERTISING","domain":".wayfair.de","path":"/","expires":1730219074.509058,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"__ssid","value":"5a52db7d368f85a236b8ed8bf1f8857","domain":".wayfair.de","path":"/","expires":1730219075.184766,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"rskxRunCookie","value":"0","domain":".wayfair.de","path":"/","expires":1730273828.325667,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"rCookie","value":"7q2ro4mok47ofer1yog0aklmz3ms9j","domain":".wayfair.de","path":"/","expires":1730273829.985331,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_gid","value":"GA1.2.1395619354.1695659323","domain":".wayfair.de","path":"/","expires":1695800227,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_gcl_au","value":"1.1.1512914385.1695659324","domain":".wayfair.de","path":"/","expires":1703435324,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"vid","value":"23f6c71e-6512-7792-8aaf-472c1accca02","domain":".wayfair.de","path":"/","expires":1695734487.277598,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"i18nPrefs","value":"lang%3Dde-DE","domain":"wayfair.de","path":"/","expires":1727245077.758,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"CSNUtId","value":"23f6c71e-6511-b43f-8aaf-472c663a1a02","domain":"wayfair.de","path":"/","expires":1730219071.928,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"ExCSNUtId","value":"23f6c71e-6511-b43f-8aaf-472c663a1a02","domain":"wayfair.de","path":"/","expires":1730219071.928,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"CSN_CSRF","value":"563e8492f39e6d0b6aab263e7c5e61ae24c42e60d657b92df0222884d60c6fc4","domain":"wayfair.de","path":"/","expires":1695745471.928,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"CSN","value":"g_countryCode%3DDE%26g_zip%3D55595","domain":"wayfair.de","path":"/","expires":1730269077.758,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"cc_post_exp","value":"1","domain":"wayfair.de","path":"/","expires":1696263872,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"user_cookie_prefs","value":"NECESSARY%2CADMINISTRATIVE%2CPERSONALIZATION%2CANALYTICS%2CADVERTISING","domain":"wayfair.de","path":"/","expires":1730219074.509,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"__ssid","value":"5a52db7d368f85a236b8ed8bf1f8857","domain":"wayfair.de","path":"/","expires":1730219075.184,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"rskxRunCookie","value":"0","domain":"wayfair.de","path":"/","expires":1730219548.251,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"rCookie","value":"7q2ro4mok47ofer1yog0aklmz3ms9j","domain":"wayfair.de","path":"/","expires":1730219549.223,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_gid","value":"GA1.2.1395619354.1695659323","domain":"wayfair.de","path":"/","expires":1695745948,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_gcl_au","value":"1.1.1512914385.1695659324","domain":"wayfair.de","path":"/","expires":1703435324,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"otx","value":"I/bHHmURtTiKr0csZz9EAg==","domain":"wayfair.de","path":"/","expires":1703435324,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"otx","value":"I/bHHmURtTiKr0csZz9EAg==","domain":".wayfair.de","path":"/","expires":1703435324,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"WFDC","value":"FRA","domain":".wayfair.de","path":"/","expires":1695730883.193818,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"canary","value":"1","domain":".wayfair.de","path":"/","expires":1730282923.848127,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"vid","value":"23f6c71e-6512-7792-8aaf-472c1accca02","domain":"wayfair.de","path":"/","expires":1695733725.765,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"WFDC","value":"FRA","domain":"wayfair.de","path":"/","expires":1695730883.193,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"SFSID","value":"7bc371b5d5ade2be85d133222488369c","domain":"wayfair.de","path":"/","expires":1695725926.134,"httpOnly":true,"secure":false,"sameSite":"Lax"},{"name":"serverUAInfo","value":"%7B%22browser%22%3A%22Google%20Chrome%22%2C%22browserVersion%22%3A115%2C%22OS%22%3A%22Mac%20OS%20X%22%2C%22OSVersion%22%3A10.157%2C%22isMobile%22%3Afalse%2C%22isTablet%22%3Afalse%2C%22isTouch%22%3Afalse%7D","domain":"wayfair.de","path":"/","expires":1695725926.134,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"canary","value":"0","domain":"wayfair.de","path":"/","expires":1730269075.368,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"_ga","value":"GA1.2.946733499.1695659323","domain":"wayfair.de","path":"/","expires":1730272308.109,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"lastRskxRun","value":"1695712308257","domain":"wayfair.de","path":"/","expires":1730272308.257,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_ga_QTD280F1PT","value":"GS1.1.1695709082.2.1.1695712308.59.0.0","domain":"wayfair.de","path":"/","expires":1730272308.07,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_px3","value":"eaa8aa4ff2dd77a779a04be4c48b6d224a5ef744d8007eaf3472b566fb3c2e2b:vgomWPDT1tRcx3nS9knXNn7qUQh1IiLne+stwXBR8pWj1TwUYgqaEWwLrmfO/E/a+TCuOqoqeM1oaU0LLkAyTA==:1000:75HyinZvRcueZg1BMZ+2T8DnbpVzfgwtctRe+X0e1H2/okcO13TcuvQ4fBcoZ572rIQmSeeUzTX+F0wN4g04YRxMa2RP/grZF6YXjAF/3hArzROWWNgaPQhmZXz6GsVpuC1W07dN4swAf8YBeiRxoUJ+7cXfMdKXkl0RhA8e1FV7sw/uqnHQqI4eEDaqKNqpU2bBxcwABYWibHDDsGw5hf+xc79hjNiQCyLq296t7tQ=","domain":"www.wayfair.de","path":"/","expires":1696932525,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"SFSID","value":"7bc371b5d5ade2be85d133222488369c","domain":".wayfair.de","path":"/","expires":-1,"httpOnly":true,"secure":false,"sameSite":"Lax"},{"name":"serverUAInfo","value":"%7B%22browser%22%3A%22Google%20Chrome%22%2C%22browserVersion%22%3A115%2C%22OS%22%3A%22Mac%20OS%20X%22%2C%22OSVersion%22%3A10.157%2C%22isMobile%22%3Afalse%2C%22isTablet%22%3Afalse%2C%22isTouch%22%3Afalse%7D","domain":".wayfair.de","path":"/","expires":-1,"httpOnly":false,"secure":true,"sameSite":"Lax"},{"name":"_ga","value":"GA1.1.946733499.1695659323","domain":".wayfair.de","path":"/","expires":1730273827.718163,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"_ga_QTD280F1PT","value":"GS1.1.1695709082.2.1.1695713827.60.0.0","domain":".wayfair.de","path":"/","expires":1730273827.943521,"httpOnly":false,"secure":false,"sameSite":"Lax"},{"name":"lastRskxRun","value":"1695713828324","domain":".wayfair.de","path":"/","expires":1730273828.32494,"httpOnly":false,"secure":false,"sameSite":"Lax"}]`,
      // },
    };

    console.log(`Adding IP: ${JSON.stringify(documentData)}`);

    await ipsCollection
      .doc(ip)
      .set(documentData)
      .then((_ref) => {
        console.log(`Added IP address with ID: ${ip}`);
      })
      .catch((error) => {
        console.error(`Error adding IP address: ${error}`);
      });
  }

  console.log("Done.");
}

await addIpAddresses(ips);
