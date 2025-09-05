import { Request, Response } from "express";

export async function addToSubscriberList(req: Request, res: Response) {
  try {
    const { userId: channelId } = req.params;
    const { id: userId } = req.body;

    if (!userId || !channelId) {
      return res.status(400).json({ msg: "Missing user or channel id" });
    }

    return res.status(200).json({ msg: "Subscribe fetched successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}

export async function removeFromSubscriberList(req: Request, res: Response) {
  try {
    const { userId: channelId } = req.params;
    const { id: userId } = req.body;

    if (!userId || !channelId) {
      return res.status(400).json({ msg: "Missing user or channel id" });
    }

    return res.status(200).json({ msg: "Subscribe fetched successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}
