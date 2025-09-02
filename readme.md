# 🎬 YouTube Backend

A scalable **YouTube-like backend service** built with **Node.js, TypeScript, Express, PostgreSQL, Redis, DynamoDB, and AWS S3**.  
This project provides APIs for user authentication, video uploading, streaming, liking, commenting, and subscribing to channels.

The backend is containerized using **Docker** and tested with **Postman**.

---

## 🚀 Tech Stack

- **Node.js + TypeScript** – Backend runtime & type safety
- **Express.js** – REST API framework
- **PostgreSQL** – Relational database for structured data (users, videos, subscriptions, likes, comments)
- **Redis** – Caching and session management
- **DynamoDB** – Analytics and tracking (e.g., watch history, video views)
- **AWS S3** – Video storage
- **Docker** – Containerized deployment
- **Postman** – API testing

---

## 📌 Features

- 👤 User authentication (register/login/logout)
- 📹 Video upload to **S3** and streaming
- 👍 Like/Unlike videos
- 💬 Comment on videos
- 🔔 Subscribe/Unsubscribe channels
- 📜 Video feed & recommendations
- 📈 Video analytics (views, watch history, subscriptions)

---

## 📂 API Endpoints

### 👤 Authentication

| Method | Endpoint             | Description                |
| ------ | -------------------- | -------------------------- |
| POST   | `/api/auth/register` | Register new user          |
| POST   | `/api/auth/login`    | User login (JWT-based)     |
| POST   | `/api/auth/logout`   | Logout and clear session   |
| GET    | `/api/auth/profile`  | Get logged-in user profile |

---

### 📹 Videos

| Method | Endpoint                 | Description                    |
| ------ | ------------------------ | ------------------------------ |
| POST   | `/api/videos/upload`     | Upload video (store in **S3**) |
| GET    | `/api/videos/:id`        | Get video details              |
| GET    | `/api/videos/stream/:id` | Stream video from **S3**       |
| DELETE | `/api/videos/:id`        | Delete a video                 |
| GET    | `/api/videos`            | List all videos (feed)         |

---

### 👍 Likes

| Method | Endpoint                 | Description                 |
| ------ | ------------------------ | --------------------------- |
| POST   | `/api/videos/:id/like`   | Like a video                |
| POST   | `/api/videos/:id/unlike` | Unlike a video              |
| GET    | `/api/videos/:id/likes`  | Get likes count for a video |

---

### 💬 Comments

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/api/videos/:id/comments` | Add a comment            |
| GET    | `/api/videos/:id/comments` | Get comments for a video |
| DELETE | `/api/comments/:commentId` | Delete a comment         |

---

### 🔔 Subscriptions

| Method | Endpoint                        | Description                |
| ------ | ------------------------------- | -------------------------- |
| POST   | `/api/channels/:id/subscribe`   | Subscribe to a channel     |
| POST   | `/api/channels/:id/unsubscribe` | Unsubscribe from a channel |
| GET    | `/api/channels/:id/subscribers` | Get list of subscribers    |

---

### 📈 Analytics / History

| Method | Endpoint                     | Description                        |
| ------ | ---------------------------- | ---------------------------------- |
| POST   | `/api/videos/:id/view`       | Record a video view (**DynamoDB**) |
| GET    | `/api/users/history`         | Get watch history                  |
| GET    | `/api/users/recommendations` | Get recommended videos             |

---

## 🐳 Running with Docker

```bash
# Clone the repo
git clone https://github.com/your-username/youtube-backend.git
cd youtube-backend

# Build and start containers
docker-compose up --build
```
