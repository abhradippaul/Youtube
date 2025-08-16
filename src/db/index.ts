import dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";

const conString = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@localhost:5432/${process.env.DB_NAME}`;

const client = new Client(conString);

export { client };
