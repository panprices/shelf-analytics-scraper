import { Cookie, PlaywrightCrawlingContext, log } from "crawlee";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/**
 * Retrieve and add cached cookies from Firestore to the current browser context.
 */
export async function addCachedCookiesToBrowserContext(
  firestore: Firestore,
  ctx: PlaywrightCrawlingContext,
  retailerDomain: string
): Promise<void> {
  const currentIp = ctx.proxyInfo?.hostname;
  if (!currentIp) {
    // Should not throw error here, else it will break browser
    // which shut down the whole request batch.
    log.error("Cannot extract current IP to sync to Firebase");
    return;
  }
  const cookies = await getCookiesFromFirestore(
    firestore,
    currentIp,
    retailerDomain
  );
  if (cookies.length > 0) {
    await ctx.page.context().addCookies(cookies);
  }
}

/**
 * Sync cookies from the current browser context to Firestore. So that it can be
 * re-used in another docker instance on the cloud.
 */
export async function syncBrowserCookiesToFirestore(
  firestore: Firestore,
  ctx: PlaywrightCrawlingContext,
  retailerDomain: string
) {
  const currentIp = ctx.proxyInfo?.hostname;
  if (!currentIp) {
    // Should not throw error here, else it will break browser
    // which shut down the whole request batch.
    log.error("Cannot extract current IP to sync to Firebase");
    return;
  }
  const cookies = await ctx.page.context().cookies(ctx.page.url());
  log.info("Cookies in postNav", { cookies });
  if (ctx.response?.status() === 200 && cookies) {
    await syncCookieToFirestore(firestore, cookies, currentIp, retailerDomain);
  }
}

export async function newAvailableIp() {
  const NR_IPS = 10;
  const firestore = getFirestore();
  const nextAvailableProxy = await firestore
    .collection("proxy_status")
    .orderBy("last_burned", "asc")
    // Check if IP has not been burned in the past 30 minutes
    .where("last_burned", "<", new Date(Date.now() - 30 * 60 * 1000))
    .orderBy("last_used", "asc")
    .limit(NR_IPS - 2)
    .get();

  if (nextAvailableProxy.empty) {
    // Potential improvement: delay the execution of all tasks. Should be long
    // enough that the proxies are unblocked.
    throw Error("No proxy available");
  }
  const ip =
    nextAvailableProxy.docs[
      Math.floor(Math.random() * nextAvailableProxy.docs.length)
    ].get("ip");

  // Update last_used
  await firestore.collection("proxy_status").doc(ip).update({
    last_used: new Date(),
  });

  return ip;
}

/**
 * Get the cookies tied to an IP, which was cached in the previous scraping session.
 *
 * Useful to immitate a real browser behavior.
 */
async function getCookiesFromFirestore(
  firestore: Firestore,
  ip: string,
  domain: string
): Promise<Cookie[]> {
  const doc = await firestore.collection("proxy_status").doc(ip).get();

  const cookieCache = doc.data();
  const cookiesJson = cookieCache?.cookies ? cookieCache.cookies[domain] : null;
  if (!cookiesJson) {
    return [];
  }

  const cookies: Cookie[] = JSON.parse(cookiesJson).filter(
    (c: Cookie) =>
      c.expires && (c.expires === -1 || c.expires > new Date().getTime() / 1000)
  );

  log.info("Found cached cookies", {
    nrCookies: cookies.length,
    ip,
    domain,
  });

  // Remove these 2 logs after Oct. 2023.
  log.info("Found cached cookies (including stale cookies)", {
    nrCookiesIncludingStaleOnes: JSON.parse(cookiesJson).length,
    ip,
    domain,
  });
  log.info("Next most recent cookie expires at", {
    date: new Date(
      cookies
        .map((c) => c.expires!)
        .filter((expires) => expires > 0)
        .sort()[0] * 1000
    ),
  });

  return cookies;
}

async function syncCookieToFirestore(
  firestore: Firestore,
  cookies: Cookie[],
  ip: string,
  domain: string
) {
  await firestore
    .collection("proxy_status")
    .doc(ip)
    .update({
      cookies: {
        [domain]: JSON.stringify(cookies),
      },
    });

  log.info(`Updated cookies on Firestore`, {
    nrCookies: cookies.length,
    ip,
    domain,
  });
}

async function removeCookies(firestore: Firestore, ip: string, domain: string) {
  await firestore
    .collection("proxy_status")
    .doc(ip)
    .update({
      cookies: {
        [domain]: "[]",
      },
    });
  log.info(`Cookies removed on Firestore`, { ip, domain });
}
