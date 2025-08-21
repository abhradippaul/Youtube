import { createClient } from "redis";

const client = createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

export { client };
