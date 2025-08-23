import multer from "multer";

const storage = multer.memoryStorage();
const uploadImage = multer({ storage });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/videos/"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const videoUpload = multer({
  storage: diskStorage,
});

export { uploadImage, videoUpload };
