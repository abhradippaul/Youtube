import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });
const videoUpload = multer({ dest: "uploads/videos/" });

export { upload, videoUpload };
