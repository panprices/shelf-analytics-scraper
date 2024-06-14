import { DetailErrorHandler } from "./interface";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { CaptchaEncounteredError } from "../../types/errors";
import { getFirestore } from "firebase-admin/lib/firestore";

export class AntiBotDetailErrorHandler implements DetailErrorHandler {
  handleCrawlDetailPageError(error: any, ctx: PlaywrightCrawlingContext) {
    // For now Captcha logic is wayfair specific
    if (error instanceof CaptchaEncounteredError) {
      log.error(`Captcha encountered`, {
        url: ctx.page.url(),
        requestUrl: ctx.request.url,
        errorType: error.name,
        errorMessage: error.message,
      });

      ctx.session?.retire();
      const firestoreDB = getFirestore();
      const proxyUrl = ctx.proxyInfo?.url;

      // Proxy URL is has the following format: `http://panprices:BB4NC4WQmx@${ip}:60000`
      if (proxyUrl) {
        const proxyIp = proxyUrl.split("@")[1].split(":")[0];
        firestoreDB
          .collection("proxy_status")
          .where("ip", "==", proxyIp)
          .get()
          .then((snapshot) => {
            snapshot.forEach((doc) => {
              firestoreDB
                .collection("proxy_status")
                .doc(doc.id)
                .update({
                  last_burned: new Date(),
                })
                .then(() => log.warning(`IP ${proxyIp} blocked`));
            });
          });
      }

      throw error;
    }
  }
}
