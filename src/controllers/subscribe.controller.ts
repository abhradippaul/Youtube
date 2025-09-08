import { Request, Response } from "express";
import { pool } from "../db/index";
import { v4 as uuidv4 } from "uuid";

export async function addToSubscriberList(req: Request, res: Response) {
  try {
    const { userId: channelId } = req.params;
    const { id: userId } = req.body;

    if (!userId || !channelId) {
      return res.status(400).json({ msg: "Missing user or channel id" });
    }

    const isChannelAndUserExist = await pool.query(
      `WITH
        is_user_exist AS (
          SELECT EXISTS (
            SELECT 1 FROM users WHERE id = $1
          ) AS value
        ),
        is_already_subscribed AS (
          SELECT EXISTS (
            SELECT 1 FROM subscriptions WHERE user_id = $1 AND channel_id = $2
          ) AS value
        ),
        is_channel_exist AS (
          SELECT EXISTS (
            SELECT 1 FROM users WHERE id = $2
          ) AS value
        )
      SELECT
        is_user_exist.value AS is_user_exist,
        is_channel_exist.value AS is_channel_exist,
        is_already_subscribed.value AS is_already_subscribed
      FROM is_user_exist, is_channel_exist LEFT JOIN is_already_subscribed ON true;
      `,
      [userId, channelId]
    );

    if (isChannelAndUserExist.rows[0]?.is_already_subscribed) {
      return res.status(400).json({ msg: "Already subscribed" });
    }

    if (
      !isChannelAndUserExist.rows[0]?.is_user_exist ||
      !isChannelAndUserExist.rows[0]?.is_channel_exist
    ) {
      return res.status(400).json({ msg: "User or channel not exist" });
    }

    const isSubscribed = await pool.query(
      `INSERT INTO subscriptions(id, channel_id, user_id) VALUES($1, $2, $3);`,
      [uuidv4(), channelId, userId]
    );

    if (!isSubscribed.rowCount) {
      return res.status(400).json({ msg: "Failed to Subscribe" });
    }

    return res.status(200).json({ msg: "Subscribed successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}

export async function removeFromSubscriberList(req: Request, res: Response) {
  try {
    const { userId: channelId } = req.params;
    const { id: userId } = req.body;
    const { subId } = req.query;

    if (!userId || !channelId || !subId) {
      return res.status(400).json({ msg: "Missing user or channel id" });
    }

    const isUnsubscribed = await pool.query(
      `DELETE FROM subscriptions WHERE id = $1 AND channel_id = $2 AND user_id = $3`,
      [subId, channelId, userId]
    );

    if (!isUnsubscribed.rowCount) {
      return res.status(400).json({ msg: "Failed to unsubsribe" });
    }

    return res.status(200).json({ msg: "Unubscribe successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}
