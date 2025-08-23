import { createClient } from "redis";

const client = createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

export async function flushRedis() {
  await (await client).flushAll();
}

export async function createRedisKey(key: string, value: string) {
  await (await client).set(key, value);
}

export async function getRedisKey(key: string) {
  return await (await client).get(key);
}

export async function deleteRedisKey(key: string) {
  return await (await client).del(key);
}
