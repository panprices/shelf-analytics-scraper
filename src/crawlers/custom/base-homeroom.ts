import { Locator, Page } from "playwright-core";

export async function extractImagesFromDetailedPage(
  page: Page
): Promise<string[]> {
  const imagesSelector = page.locator(
    "//li[contains(@class, 'product-gallery-item')]//source[1]"
  );
  const imageCount = await imagesSelector.count();

  const getImgUrlFromSourceTag = async (sourceTag: Locator) => {
    const srcset = <string>await sourceTag.getAttribute("srcset");
    const imageUrl = srcset.split(",")[0].split(" ")[0];
    return imageUrl;
  };

  if (imageCount > 0) {
    const images = [];
    for (let i = 0; i < imageCount; i++) {
      const sourceTag = imagesSelector.nth(i);
      images.push(await getImgUrlFromSourceTag(sourceTag));
    }
    return images;
  } else {
    // Only 1 image
    const sourceTag = page.locator("div.product-gallery source").first();
    return [await getImgUrlFromSourceTag(sourceTag)];
  }
}
