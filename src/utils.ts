const { CloudTasksClient } = require("@google-cloud/tasks");
// Instantiates a client.
const client = new CloudTasksClient();

export const scheduleNextPage = async (url: string, inSeconds: number) => {
  const project = "panprices";
  const queue = "test-crawlee-queue";
  const location = "europe-west1";
  // Construct the fully qualified queue name.
  const parent = client.queuePath(project, location, queue);

  const destinationUrl =
    "https://test-crawlee-kq7q53zcma-ew.a.run.app/trademax";
  const payload = {
    url: url,
  };

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: destinationUrl,
      scheduleTime: {
        seconds: inSeconds + Date.now() / 1000,
      },
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
  };

  // Send create task request.
  console.log("Sending task:");
  console.log(task);
  const request = { parent: parent, task: task };
  const [response] = await client.createTask(request);
  console.log(`Created task ${response.name}`);
};
