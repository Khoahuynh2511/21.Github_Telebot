# GitHub Actions Telegram Bot

Bot Telegram thông báo trạng thái GitHub Actions với các tính năng nâng cao.

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Cài đặt](#-cài-đặt)
- [Cấu hình](#-cấu-hình)
- [Sử dụng](#-sử-dụng)
- [Tính năng nâng cao](#-tính-năng-nâng-cao)
- [Ví dụ thực tế](#-ví-dụ-thực-tế)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Tính năng

### Cơ bản
- ✅ Nhận thông báo workflow success/failure
- ✅ Thông tin chi tiết về commit, branch, actor
- ✅ Link trực tiếp đến workflow run
- 📋 Thông báo từng job/task trong workflow
- 🎯 Xem step nào bị lỗi trong job
- 🔄 Retry failed workflows từ Telegram
- 📝 Xem logs trực tiếp trong chat

### Nâng cao
- 🔔 Lọc thông báo theo repository/branch/workflow
- 📊 Thống kê workflow (success rate, thời gian chạy)
- 📅 Scheduled reports - Báo cáo hàng ngày/tuần tự động
- 🚨 Alert rules - Cảnh báo khi workflow chạy chậm hoặc fail nhiều
- 💰 Cost tracking - Theo dõi chi phí GitHub Actions
- 🚀 Deployment tracking - Theo dõi deployments
- 👥 Team channels - Gửi thông báo vào Telegram group
- ⏰ Tùy chỉnh thời gian nhận thông báo (quiet hours)

---

## 🚀 Cài đặt

### Bước 1: Clone Repository

```bash
git clone https://github.com/your-username/github-bot.git
cd github-bot
npm install
```

### Bước 2: Tạo Telegram Bot

1. Mở Telegram và tìm `@BotFather`
2. Gửi `/newbot`
3. Đặt tên bot (ví dụ: "GitHub Actions Notifier")
4. Đặt username (phải kết thúc bằng "bot", ví dụ: `my_github_actions_bot`)
5. Copy token nhận được

### Bước 3: Tạo GitHub Personal Access Token

1. Vào GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Chọn scopes:
   - `repo` (full control)
   - `workflow` (update workflows)
4. Copy token

### Bước 4: Tạo Webhook Secret

```bash
# Tạo random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Bước 5: Cấu hình .env

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
# Telegram Bot Token từ @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890

# GitHub Personal Access Token
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz

# Webhook Secret (tạo random string)
GITHUB_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Port cho webhook server
PORT=3000

# URL công khai của server (cho webhook)
PUBLIC_URL=https://your-domain.com

# Admin Telegram User IDs (tùy chọn)
ADMIN_USER_IDS=123456789,987654321
```

### Bước 6: Deploy Server

#### Option A: Deploy lên Railway (Khuyến nghị)

1. Push code lên GitHub
2. Truy cập https://railway.app
3. Click "New Project" → "Deploy from GitHub repo"
4. Chọn repository
5. Thêm environment variables từ `.env` (trừ PORT)
6. Deploy và lấy public URL
7. Update `PUBLIC_URL` trong environment variables

#### Option B: Deploy lên Render

1. Truy cập https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Thêm environment variables
6. Deploy và lấy URL

#### Option C: Deploy lên VPS

```bash
# Cài đặt dependencies
npm install

# Chạy với PM2
npm install -g pm2
pm2 start src/index.js --name github-bot
pm2 save
pm2 startup
```

#### Option D: Development với Ngrok

```bash
# Terminal 1: Chạy bot
npm start

# Terminal 2: Chạy ngrok
ngrok http 3000
# Copy URL từ ngrok và update PUBLIC_URL
```

### Bước 7: Cấu hình GitHub Webhook

1. Vào repository Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/webhook/github`
3. Content type: `application/json`
4. Secret: Paste `GITHUB_WEBHOOK_SECRET` từ `.env`
5. Events: Chọn "Let me select individual events"
   - ✅ Workflow runs (thông báo workflow hoàn thành)
   - ✅ Workflow jobs (thông báo từng job/task)
   - ✅ Deployment statuses (theo dõi deployments)
6. Active: ✅
7. Click "Add webhook"

### Bước 8: Test Bot

1. Mở Telegram và tìm bot của bạn
2. Gửi `/start`
3. Subscribe repository: `/subscribe owner/repo`
4. Bật thông báo jobs: `/notifyjobs on`
5. Trigger một workflow trên GitHub
6. Nhận thông báo trên Telegram!

---

## ⚙️ Cấu hình

### PUBLIC_URL là gì?

`PUBLIC_URL` là địa chỉ công khai trên internet mà GitHub có thể gọi đến để gửi webhook.

**Cách hoạt động:**
```
GitHub Actions chạy
       ↓
GitHub gửi webhook → PUBLIC_URL/webhook/github
       ↓
Bot nhận thông báo
       ↓
Bot gửi tin nhắn Telegram
```

**Tại sao cần PUBLIC_URL?**
- GitHub không thể gọi đến `localhost` của bạn
- Cần một URL công khai để nhận webhook
- Không có PUBLIC_URL = Không nhận thông báo realtime

**Các option:**
- **Development**: Dùng Ngrok (URL thay đổi mỗi lần restart)
- **Production**: Deploy lên Railway/Render (URL cố định, free tier)
- **Advanced**: VPS với custom domain

### Lấy Telegram User ID

**Option A: Dùng bot**
1. Gửi tin nhắn cho `@userinfobot`
2. Bot sẽ trả về User ID

**Option B: Dùng bot của bạn**
1. Thêm code log trong bot:
```javascript
bot.on('message', (msg) => {
  console.log('User ID:', msg.from.id);
});
```
2. Gửi tin nhắn cho bot
3. Xem console log

---

## 📱 Sử dụng

### Commands Cơ bản

```bash
/start                      # Khởi động bot
/subscribe owner/repo       # Đăng ký nhận thông báo
/unsubscribe owner/repo     # Hủy đăng ký
/list                       # Danh sách subscriptions
```

### Thông báo Jobs

```bash
/notifyjobs on              # Bật thông báo từng job
/notifyjobs off             # Tắt thông báo jobs
```

**Khi bật**, bạn sẽ nhận:
- Thông báo cho TỪNG JOB trong workflow
- Tên job (build, test, deploy, etc.)
- Status và duration của job
- **Step nào bị lỗi** (nếu job failed)

### Thống kê

```bash
/stats owner/repo                    # Thống kê workflow
/jobstats owner/repo workflow-name   # Thống kê jobs
```

**Output ví dụ:**
```
📊 Thống kê 7 ngày qua
Repository: myorg/myapp

🔧 CI
   Total: 45 | ✅ 43 | ❌ 2
   Success rate: 95.6%
   Avg duration: 5m 23s

📋 Jobs:
   build: 2m 15s avg
   test-backend: 2m 45s avg
   deploy: 3m 12s avg
```

### Bộ lọc

```bash
/filter                     # Cấu hình bộ lọc
```

**Tùy chọn:**
- Chỉ nhận từ branch cụ thể
- Chỉ nhận từ workflow cụ thể
- Chỉ nhận khi failed (bỏ qua success)

### Quiet Hours

```bash
/quiet 22 8                 # Im lặng từ 22h đến 8h sáng
/quiet 0 0                  # Tắt quiet hours
```

### Logs

```bash
/logs <run_id>              # Xem logs workflow
```

---

## 🔥 Tính năng nâng cao

### 1. Scheduled Reports

Nhận báo cáo tự động về workflows.

```bash
/report daily on            # Báo cáo hàng ngày (9:00 AM)
/report daily off           # Tắt báo cáo hàng ngày

/report weekly on           # Báo cáo hàng tuần (9:00 AM thứ Hai)
/report weekly off          # Tắt báo cáo hàng tuần
```

**Báo cáo bao gồm:**
- Tổng số workflow runs
- Success rate của mỗi workflow
- Trend so với tuần trước (📈 tăng, 📉 giảm)
- Số lượng deployments
- Top workflows có vấn đề

### 2. Alert Rules

Tạo rules để nhận cảnh báo tự động.

```bash
# Cảnh báo khi workflow chạy quá lâu
/alert owner/repo CI duration 300
# → Cảnh báo nếu CI chạy >5 phút

# Cảnh báo khi tỷ lệ lỗi cao
/alert owner/repo Tests failure_rate 20
# → Cảnh báo nếu >20% workflows bị lỗi

# Xem danh sách alerts
/alerts
```

**Ví dụ alert:**
```
🚨 ALERT

Workflow `CI` trong `myorg/backend` đang chạy chậm!

⏱ Thời gian trung bình: 387s
⚠️ Ngưỡng cảnh báo: 300s
```

### 3. Cost Tracking

Theo dõi chi phí GitHub Actions.

```bash
/cost owner/repo            # Xem chi phí 30 ngày qua
```

**Output:**
```
💰 Chi phí 30 ngày qua - myorg/backend

💵 Tổng chi phí: $45.67
⏱ Tổng thời gian: 5,709 phút

Top workflows:
  CI: $23.45 (234 runs)
  Deploy Production: $12.34 (45 runs)
  Tests: $9.88 (156 runs)
```

**Pricing (theo GitHub):**
- Ubuntu: $0.008/phút
- Windows: $0.016/phút
- macOS: $0.08/phút
- Ubuntu 4-core: $0.016/phút
- Ubuntu 8-core: $0.032/phút
- Ubuntu 16-core: $0.064/phút

### 4. Deployment Tracking

Theo dõi deployments và xem lịch sử.

```bash
/deployments owner/repo     # Xem lịch sử deployments
```

**Output:**
```
🚀 Deployments - 7 ngày qua
`myorg/backend`

✅ production - v2.3.1
   By: john | 29/01/2026

✅ staging - main
   By: jane | 28/01/2026

❌ production - v2.3.0
   By: john | 27/01/2026
```

### 5. Team Channels

Gửi thông báo vào Telegram group cho cả team.

```bash
# Trong Telegram group:
/teamchannel add owner/repo      # Thêm repo vào team channel
/teamchannel remove owner/repo   # Xóa repo khỏi team channel
```

**Use cases:**
- **Dev team channel**: Nhận tất cả CI/CD notifications
- **DevOps channel**: Chỉ nhận deployment notifications
- **Management channel**: Chỉ nhận weekly reports

---

## 💡 Ví dụ thực tế

### Scenario 1: Developer cá nhân

```bash
# Setup
/start
/subscribe myusername/personal-project
/subscribe company/backend
/notifyjobs on              # Debug chi tiết
/quiet 22 8                 # Ngủ ngon
```

### Scenario 2: Team Development

```bash
# Tạo Telegram group "Backend Team"
# Thêm bot vào group

# Trong group:
/teamchannel add company/backend

# Mỗi thành viên cũng subscribe riêng:
/subscribe company/backend
/filter                     # Chỉ nhận failures trong DM
```

### Scenario 3: DevOps/SRE

```bash
# Subscribe production repos
/subscribe company/api
/subscribe company/web

# Setup alerts
/alert company/api Deploy duration 600
/alert company/api CI failure_rate 15

# Bật báo cáo tuần
/report weekly on

# Xem chi phí
/cost company/api
```

### Scenario 4: Debug CI Failure

```bash
# 1. Nhận thông báo
❌ Workflow thất bại
📦 Repository: company/backend
🔧 Workflow: CI
📋 Job: test-api
❗ Failed steps: Run integration tests

# 2. Click "📝 Logs" để xem chi tiết

# 3. Fix code và push

# 4. Nhận thông báo success
✅ Workflow thành công
```

### Scenario 5: Optimize CI Performance

```bash
# 1. Xem thống kê
/stats company/backend
# Avg duration: 8m 34s ← Quá lâu!

# 2. Xem chi tiết jobs
/jobstats company/backend CI
# test-integration: 4m 30s ← Bottleneck!

# 3. Optimize test-integration job

# 4. Sau 1 tuần, check lại
/stats company/backend
# Avg duration: 5m 12s ← Cải thiện 40%!
```

### Scenario 6: Cost Management

```bash
# 1. Xem tổng chi phí
/cost company/backend
# Tổng chi phí: $127.45
# CI: $78.23 (456 runs) ← Chạy nhiều nhất

# 2. Optimize CI:
# - Cache dependencies
# - Parallel jobs
# - Skip unnecessary steps

# 3. Tháng sau check lại
/cost company/backend
# Tổng chi phí: $89.34 ← Tiết kiệm 30%!
```

---

## 🔧 Troubleshooting

### Bot không khởi động

**Lỗi:** `Error: 401 Unauthorized`

**Nguyên nhân:** `TELEGRAM_BOT_TOKEN` sai

**Giải pháp:** Kiểm tra lại token từ @BotFather

---

### Webhook 401 Unauthorized

**Nguyên nhân:** `GITHUB_WEBHOOK_SECRET` không khớp

**Giải pháp:**
1. Copy secret từ `.env`
2. Paste vào GitHub webhook settings
3. Save webhook

---

### Không nhận được thông báo

**Nguyên nhân:**
- Chưa `/start` bot
- Chưa `/subscribe` repo
- Webhook chưa setup đúng

**Giải pháp:**
```bash
# 1. Gửi /start cho bot
/start

# 2. Subscribe repo
/subscribe owner/repo

# 3. Kiểm tra webhook trên GitHub
# Repository → Settings → Webhooks → Recent Deliveries
# Xem response: ✅ 200 OK hoặc ❌ Error
```

---

### Không retry được workflow

**Nguyên nhân:** `GITHUB_TOKEN` sai hoặc thiếu quyền

**Giải pháp:**
1. Tạo token mới với đủ quyền (`repo`, `workflow`)
2. Update `.env`
3. Restart bot

---

### Webhook timeout

**Nguyên nhân:** Bot không chạy hoặc URL sai

**Giải pháp:**
```bash
# Kiểm tra bot đang chạy
curl https://your-url.com/health

# Kiểm tra logs
# Railway: Xem Deployments → Logs
# VPS: pm2 logs github-bot
# Local: Xem terminal
```

---

### Quá nhiều notifications

**Giải pháp:**
```bash
/filter                     # Chỉ nhận failures
/notifyjobs off             # Tắt job notifications
/quiet 22 8                 # Đặt quiet hours
```

---

## 📚 Tips & Best Practices

### 1. Organize Subscriptions
```bash
# Personal projects
/subscribe user/project1

# Work projects
/subscribe company/backend

# Open source (chỉ xem tổng quan)
/subscribe facebook/react
/notifyjobs off
```

### 2. Smart Filtering
```bash
# Production repos: Nhận tất cả
/subscribe company/api

# Staging repos: Chỉ failures
/subscribe company/api-staging
/filter  # Only failures
```

### 3. Alert Thresholds
```bash
# Đặt baseline trước
/stats company/backend
# CI avg: 5m 30s

# Set alert 20% cao hơn baseline
/alert company/backend CI duration 396  # 5m30s * 1.2
```

### 4. Cost Optimization Loop
```bash
# Tháng 1: Baseline
/cost company/backend  # $150/tháng

# Optimize: Add caching, reduce test runs

# Tháng 2: Measure
/cost company/backend  # $110/tháng ← Tiết kiệm 27%
```

### 5. Use Team Channels Effectively
```bash
# Channel 1: "Dev Team" - Tất cả repos
/teamchannel add company/backend

# Channel 2: "DevOps" - Chỉ deployments
# Channel 3: "Management" - Weekly reports only
```

---

## 🔒 Security Best Practices

### 1. Không commit .env vào Git
File `.gitignore` đã có:
```
.env
```

### 2. Rotate tokens định kỳ
- GitHub token: Mỗi 6 tháng
- Webhook secret: Mỗi năm
- Bot token: Khi bị lộ

### 3. Giới hạn quyền GitHub token
Chỉ chọn scopes cần thiết:
- `repo` - Nếu cần access private repos
- `workflow` - Nếu cần retry workflows
- Không chọn `admin:*` nếu không cần

### 4. Backup tokens
Lưu tokens ở nơi an toàn:
- Password manager (1Password, Bitwarden)
- Encrypted file
- Không lưu trong Slack/Discord/Email

---

## 📊 So sánh Deploy Options

| Method | Phù hợp | Chi phí | Độ khó | URL cố định |
|--------|---------|---------|--------|-------------|
| **Ngrok** | Development | Free | ⭐ | ❌ (free) |
| **Railway** | Production | Free tier | ⭐⭐ | ✅ |
| **Render** | Production | Free tier | ⭐⭐ | ✅ |
| **VPS** | Production | $5-10/tháng | ⭐⭐⭐⭐ | ✅ |

**Khuyến nghị:**
- **Development**: Dùng Ngrok
- **Production**: Deploy lên Railway hoặc Render

---

## 🎯 Checklist Hoàn thành

- [ ] Tạo Telegram bot và lấy token
- [ ] Tạo GitHub personal access token
- [ ] Tạo webhook secret
- [ ] Tạo file .env với tất cả giá trị
- [ ] Test bot khởi động thành công
- [ ] Deploy server lên production
- [ ] Setup GitHub webhook với secret
- [ ] Test nhận thông báo
- [ ] Test retry workflow (nếu cần)

Xong! 🎉

---

## 📝 License

MIT

## 🤝 Contributing

Pull requests are welcome!

## 📧 Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub.
