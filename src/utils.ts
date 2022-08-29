import {CloudTasksClient} from "@google-cloud/tasks";
import {google} from "@google-cloud/tasks/build/protos/protos";
import ICreateTaskRequest = google.cloud.tasks.v2.ICreateTaskRequest;
import ITask = google.cloud.tasks.v2.ITask;
import ITimestamp = google.protobuf.ITimestamp;
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

  const task: ITask = {
    httpRequest: {
      httpMethod: "POST",
      url: destinationUrl,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: <ITimestamp>{
      seconds: inSeconds + Date.now() / 1000,
    },
  };

  // Send create task request.
  console.log("Sending task:");
  console.log(task);
  const request: ICreateTaskRequest = { parent: parent, task: task };
  const [response] = await client.createTask(request);
  console.log(`Created task ${response.name}`);
};
