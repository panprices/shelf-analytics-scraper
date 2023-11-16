/**
 * Example usage:
 * npm run script:create-scraper nordlyliving.dk NordlyLiving
 */

import * as fs from "fs";

// read url and retailerName from CLI arguments
const url = process.argv[2];
const retailerName = process.argv[3];

const factoryFilePath = "src/crawlers/factory.ts";

const newCase = `case "${url}":
        definition = await ${retailerName}CrawlerDefinition.create(
          launchOptions
        );
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      `;

const importStatement = `import { ${retailerName}CrawlerDefinition } from "./custom/${retailerName.toLowerCase()}";`;

fs.readFile("custom-retailer.ts.template", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const newFileContents = data
    .replace(/__URL__/g, url)
    .replace(/__RETAILER_NAME__/g, retailerName);

  fs.writeFile(
    `src/crawlers/custom/${retailerName.toLowerCase()}.ts`,
    newFileContents,
    (err) => {
      if (err) {
        console.error(err);
        return;
      }

      console.log(
        `Created: src/crawlers/custom/${retailerName.toLowerCase()}.ts`
      );
    }
  );
});

fs.readFile(factoryFilePath, "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const importStatementsEndIndex =
    data.indexOf("\n", data.lastIndexOf("import")) + 1;

  // find the index of the end of the switch statement
  const switchEndIndex = data.indexOf(
    "// Comment to help the script understand where to add new cases"
  );

  // insert the new case before the end of the switch statement
  const newFileContents = `${data.slice(
    0,
    importStatementsEndIndex
  )}${importStatement}\n${data.slice(
    importStatementsEndIndex,
    switchEndIndex
  )}${newCase}${data.slice(switchEndIndex)}`;

  // write the new file contents to a new file
  fs.writeFile(factoryFilePath, newFileContents, (err) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log(`Updated: ${factoryFilePath}`);
  });
});
