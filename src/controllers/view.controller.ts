import { Request, Response } from "express";

export async function addToView(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    if (!userId || !videoId) {
      return res.status(400).json({ msg: "Missing user or video id" });
    }

    return res.status(200).json({
      msg: "Added to view successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", err: err });
  }
}
