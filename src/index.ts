import express, { Request, Response } from 'express';
import bodyParser from "body-parser";

import { scrapeCategoryPage } from "./trademax";

const app = express();
app.use(bodyParser.json());

app.get("/", (_: any, res: Response) => {
  const name = process.env.NAME || "World";
  res.send(`Hello ${name}!`);
});

app.get("/test", async (_: any, res: Response) => {
  await scrapeCategoryPage("https://www.trademax.se/m%C3%B6bler/soffor", 10);
  res.status(200).send("OK");
});

app.post("/trademax", async (req: Request, res: Response) => {
  const body = await req.body;
  console.log("Payload:" + JSON.stringify(body));

  if (body.url) {
    console.log(body.url);
    await scrapeCategoryPage(body.url, 10);
  }

  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
