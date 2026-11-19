# Caro Online (Gomoku) — Next.js 15 + Socket.IO + Upstash Redis

Website chơi cờ Caro online realtime: bàn 30×30, 5 quân liên tiếp thắng, chat trong phòng, tái đấu
khi cả hai đồng ý, giữ chỗ 60 giây khi mất kết nối và tự khôi phục bàn cờ khi reconnect.

## Tech stack

| Layer        | Công nghệ                                                      |
| ------------ | -------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| State client | Zustand                                                        |
| Realtime     | Socket.IO 4 (typed events)                                     |
| Persistence  | Upstash Redis (fallback in-memory khi chưa cấu hình)           |
| Validation   | Zod (mọi payload từ client đều được validate ở server)         |
| Tooling      | ESLint 9 (flat config), Prettier + prettier-plugin-tailwindcss |

## Chạy local

```bash
npm install
npm run dev          # http://localhost:3000 (Next.js + Socket.IO cùng 1 process)
```

Không cần Redis để chạy thử: nếu `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` trống, server
dùng store in-memory. Muốn dùng Redis thật: `cp .env.example .env.local` rồi điền thông tin Upstash.

Thử 2 người chơi: mở 2 tab (mỗi tab là một người chơi riêng vì token lưu trong `sessionStorage`).

| Script                                  | Mô tả                                               |
| --------------------------------------- | --------------------------------------------------- |
| `npm run dev`                           | Dev server (custom server: Next.js + Socket.IO)     |
| `npm run build`                         | Build production Next.js                            |
| `npm run start`                         | Chạy production (Next.js + Socket.IO cùng port)     |
| `npm run start:socket`                  | Chỉ chạy Socket.IO server (deploy tách khỏi Vercel) |
| `npm run lint` / `typecheck` / `format` | Chất lượng code                                     |

## Kiến trúc

```
server.ts                      Custom server: Next.js handler + Socket.IO trên cùng HTTP server
src/
├── app/                       App Router: Home (/), Room (/room/[roomId]), layout, 404, globals.css
├── components/
│   ├── ui/                    Button, Card, Input, Toaster
│   ├── home/HomeForm.tsx      Nhập nickname, Create Room, Join Room
│   ├── room/                  RoomView, RoomInfo, PlayerList, RoomStatusBanner, ChatPanel, NicknameGate
│   └── game/                  GameBoard, Cell (memo + animation), ResultModal (popup thắng/thua/hòa)
├── hooks/                     useRoomSocket (subscribe + auto rejoin), useNickname, useCountdown
├── store/gameStore.ts         Zustand: room, playerId, chat, connection, toasts
├── services/socketService.ts  Wrapper emitWithAck có timeout, tự connect
├── types/                     Player, Room, Move, BoardCell, ChatMessage, GameState + typed socket events
├── utils/                     checkWinner, validation, roomStatus, format
├── lib/                       constants, redis (Upstash client), socket (client singleton), identity
└── server/
    ├── socket/                Socket.IO bootstrap, handlers, zod schemas, rate limiter, disconnect timers
    ├── game/                  RoomService (nghiệp vụ), gameLogic, repository (Redis/Memory), lock, ids
    └── standalone.ts          Socket server độc lập (Render/Railway/Fly.io)
```

### Luồng dữ liệu

1. Client gọi `socketService.*` → `emitWithAck` (timeout 8s).
2. Server validate payload bằng Zod → `RoomService` thực hiện nghiệp vụ trong **per-room lock**
   (tránh race giữa move / disconnect / play-again) → lưu Redis.
3. Server broadcast sự kiện (`move-made`, `game-won`, …) và snapshot có thẩm quyền `room-updated`.
4. Client cập nhật Zustand; UI render lại. `move-made` được vẽ ngay, `room-updated` đồng bộ lại toàn bộ.

**Server là nguồn sự thật duy nhất**: kiểm tra lượt, ô đã có quân, trạng thái trận, thắng/hòa.
Client chỉ gửi ý định (`row`, `col`).

### Danh tính & reconnect

- Mỗi tab có một token bí mật ngẫu nhiên (sessionStorage). Server chỉ lưu **SHA-256 hash** của token;
  `tokenHash`/`socketId` không bao giờ gửi về client.
- Khi socket mất kết nối: người chơi bị đánh dấu `connected=false`, phát `player-left`
  (`reason: disconnected`) và hẹn giờ 60s. Nước đi bị khóa trong lúc chờ.
- Reload/mạng chập chờn: Socket.IO tự reconnect → hook gửi lại `join-room` với cùng token → server
  khôi phục ghế, gửi `room-joined` kèm bàn cờ và lịch sử chat.
- Hết 60s: người chơi bị xóa (`player-left`, `reason: timeout`), phòng về trạng thái chờ. Ngoài timer,
  server còn **prune lười** người chơi quá hạn mỗi khi có join, nên vẫn đúng sau khi server restart.
- Mở cùng ghế ở kết nối khác: kết nối cũ nhận `room-error` và bị tách khỏi phòng.

### Thuật toán `checkWinner(board, row, col)`

Chỉ xét 4 đường đi qua nước cuối (ngang, dọc, chéo chính, chéo phụ); mỗi hướng đếm tối đa 4 ô mỗi
phía ⇒ **O(1)** (tối đa 32 ô), không phụ thuộc kích thước bàn. Trả về danh sách ô thắng để highlight.
Luật tự do: ≥ 5 quân liên tiếp là thắng. Bàn đầy (900 nước) ⇒ hòa.

### Lưu trữ Redis

| Key                      | Kiểu | Nội dung                                             |
| ------------------------ | ---- | ---------------------------------------------------- |
| `caro:room:{id}`         | JSON | Room meta (id, hostId, createdAt, updatedAt)         |
| `caro:room:{id}:game`    | JSON | GameState (board, moves, turn, result, votes, round) |
| `caro:room:{id}:players` | HASH | playerId → PlayerRecord                              |
| `caro:room:{id}:chat`    | LIST | 100 tin nhắn gần nhất                                |

Ghi bằng `MULTI` (atomic), TTL 6 giờ làm mới ở mỗi lần ghi. Phòng trống bị xóa ngay.

### Socket events

| Client → Server                                                                | Server → Client                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create-room`, `join-room`, `move`, `chat-message`, `play-again`, `leave-room` | `room-created`, `room-joined`, `player-joined`, `player-left`, `move-made`, `game-won`, `draw`, `play-again-request`, `room-updated`, `chat-message`, `room-error` |

Mọi event client đều có ack `{ ok, error?, data? }`.

### Tái đấu

Sau khi trận kết thúc, mỗi người bấm **Play Again** (`play-again-request` báo cho đối thủ). Chỉ khi
cả hai đồng ý, server reset bàn, tăng `round` và **đổi phe** (X luôn đi trước nên hai người lần lượt đi trước).

### Chơi với máy (`/play/ai`)

Chế độ offline, chạy hoàn toàn trên trình duyệt (không cần socket/Redis). Người chơi chọn ai đi trước.

- `src/utils/caroAI.ts`: AI mức **Hard**, dùng iterative-deepening negamax + alpha-beta pruning.
  - Bàn cờ được đánh giá tăng dần qua mọi cửa sổ 5 ô, nên hàm đánh giá chạy O(1).
  - Nước thắng ngay và nước buộc phải chặn được xét trước tiên.
  - Mỗi nước có giới hạn thời gian khoảng 0.9 giây.
- `src/workers/caroAI.worker.ts`: chạy AI trong Web Worker để UI không bị đứng.
- `src/hooks/useAiGame.ts`: state ván đấu (reducer) và tỉ số.
- `src/components/ai/*`: giao diện; bàn cờ dùng chung component `components/game/Board.tsx`.

### Best practices đã áp dụng

- Typed Socket.IO events dùng chung giữa client/server; Zod validation; rate limit (chat 5 msg/3s,
  action 30/5s); giới hạn payload 16KB; sanitize tên/chat (React escape khi render).
- Per-room mutex chống ghi đè trạng thái; repository pattern (đổi Redis/Memory không ảnh hưởng nghiệp vụ).
- Security headers, `poweredByHeader: false`, graceful shutdown, health check `/health` cho socket server.
- UI: dark mode, responsive (board co giãn theo màn hình, sidebar xuống dưới trên mobile),
  animation đặt quân, highlight nước cuối & đường thắng, `prefers-reduced-motion`, ARIA labels.

## Deploy: Vercel + Upstash Redis

> **Lưu ý quan trọng:** Vercel chạy Next.js dưới dạng serverless/edge functions, **không giữ được
> kết nối WebSocket lâu dài** nên không thể host Socket.IO server trên Vercel. Kiến trúc chuẩn là:
> **Frontend trên Vercel** + **Socket server trên nền tảng hỗ trợ long-lived connection**
> (Render / Railway / Fly.io / VPS), cả hai dùng chung **Upstash Redis**.

### 1. Tạo Upstash Redis

1. Vào <https://console.upstash.com> → **Create Database** (Redis), chọn region gần socket server.
2. Ở tab **REST API**, copy `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.

### 2. Deploy Socket server (ví dụ Render)

1. Push code lên GitHub.
2. Render → **New Web Service** → chọn repo.
   - Build command: `npm install`
   - Start command: `npm run start:socket`
   - Health check path: `/health`
3. Environment variables:
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `CORS_ORIGIN=https://your-app.vercel.app` (nhiều domain cách nhau bởi dấu phẩy)
   - (`PORT` do Render tự cấp)
4. Sau khi deploy, ghi lại URL, ví dụ `https://caro-socket.onrender.com`.

Railway/Fly.io tương tự: start command `npm run start:socket`, cùng các biến môi trường trên.

### 3. Deploy Frontend lên Vercel

1. Vercel → **Add New Project** → import repo. Framework: Next.js (tự nhận diện).
   Build command mặc định `next build` (Vercel không dùng `server.ts`).
2. Environment variables:
   - `NEXT_PUBLIC_SOCKET_URL=https://caro-socket.onrender.com`
3. Deploy. Mở `https://your-app.vercel.app`, tạo phòng và gửi link cho bạn bè.

### Phương án 1 server (không dùng Vercel)

Trên Render/Railway/Fly/VPS có thể chạy cả Next.js + Socket.IO cùng một service:
`npm install && npm run build` rồi `npm run start`, để trống `NEXT_PUBLIC_SOCKET_URL`.

### Scale nhiều instance socket

Trạng thái phòng đã nằm trong Redis, nhưng broadcast giữa các instance cần
[`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) (dùng Redis TCP, ví dụ
Upstash `rediss://` endpoint) và sticky sessions. Per-room lock hiện tại là in-process; khi chạy
nhiều instance nên route theo room hoặc thay bằng distributed lock.
# caro-game
