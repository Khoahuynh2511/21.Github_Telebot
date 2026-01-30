import { Octokit } from 'octokit';

export class BotCommands {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  async start(msg) {
    const welcomeMessage = `👋 Chào mừng đến với GitHub Actions Bot!

Bot này giúp bạn nhận thông báo về trạng thái GitHub Actions workflows.

🚀 *Bắt đầu nhanh:*
1. /subscribe owner/repo - Đăng ký repository
2. /notifyjobs on - Bật thông báo chi tiết
3. Trigger workflow trên GitHub
4. Nhận thông báo!

📚 Gõ /info hoặc /help để xem tất cả commands`;

    await this.bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
  }

  async info(msg) {
    const infoMessage = `📚 *HƯỚNG DẪN SỬ DỤNG BOT*

━━━━━━━━━━━━━━━━━━━━━━

📋 *CƠ BẢN*

/start - Khởi động bot
/info hoặc /help - Xem hướng dẫn này
/subscribe owner/repo - Đăng ký nhận thông báo
/unsubscribe owner/repo - Hủy đăng ký
/list - Xem danh sách subscriptions

━━━━━━━━━━━━━━━━━━━━━━

🔔 *THÔNG BÁO*

/notifyjobs on - Bật thông báo từng job/task
/notifyjobs off - Tắt thông báo jobs
/filter - Cấu hình bộ lọc
/quiet start end - Đặt giờ im lặng
   Ví dụ: /quiet 22 8

━━━━━━━━━━━━━━━━━━━━━━

📊 *THỐNG KÊ*

/stats owner/repo - Thống kê workflow
/jobstats owner/repo workflow - Thống kê jobs
   Ví dụ: /jobstats facebook/react CI

━━━━━━━━━━━━━━━━━━━━━━

📅 *BÁO CÁO ĐỊNH KỲ*

/report daily on - Bật báo cáo hàng ngày
/report daily off - Tắt báo cáo hàng ngày
/report weekly on - Bật báo cáo hàng tuần
/report weekly off - Tắt báo cáo hàng tuần

━━━━━━━━━━━━━━━━━━━━━━

🚨 *CẢNH BÁO TỰ ĐỘNG*

/alert repo workflow type threshold
   Types: duration hoặc failure\\_rate
   
   Ví dụ:
   /alert owner/repo CI duration 300
   /alert owner/repo Tests failure\\_rate 20

/alerts - Xem danh sách alert rules

━━━━━━━━━━━━━━━━━━━━━━

💰 *CHI PHÍ & DEPLOYMENTS*

/cost owner/repo - Xem chi phí Actions
/deployments owner/repo - Lịch sử deployments

━━━━━━━━━━━━━━━━━━━━━━

👥 *TEAM CHANNELS*

/teamchannel add owner/repo - Thêm repo
/teamchannel remove owner/repo - Xóa repo
(Chỉ dùng trong group)

━━━━━━━━━━━━━━━━━━━━━━

🔧 *KHÁC*

/logs run\\_id - Xem logs workflow

━━━━━━━━━━━━━━━━━━━━━━

💡 *VÍ DỤ SỬ DỤNG*

*Developer:*
/subscribe myorg/backend
/notifyjobs on
/quiet 22 8

*Team lead:*
/subscribe myorg/backend
/report weekly on
/alert myorg/backend CI duration 600

*DevOps:*
/subscribe myorg/api
/alert myorg/api Deploy failure\\_rate 10
/cost myorg/api

━━━━━━━━━━━━━━━━━━━━━━

❓ *CẦN TRỢ GIÚP?*

Xem README trên GitHub
Báo lỗi: Tạo issue`;

    await this.bot.sendMessage(msg.chat.id, infoMessage, { parse_mode: 'Markdown' });
  }

  async help(msg) {
    // Alias cho /info
    await this.info(msg);
  }

  async subscribe(msg, repo) {
    const userId = msg.from.id;
    
    try {
      this.db.addSubscription(userId, repo);
      await this.bot.sendMessage(
        msg.chat.id,
        `✅ Đã đăng ký nhận thông báo từ \`${repo}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Lỗi khi đăng ký. Vui lòng thử lại.');
    }
  }

  async unsubscribe(msg, repo) {
    const userId = msg.from.id;
    
    this.db.removeSubscription(userId, repo);
    await this.bot.sendMessage(
      msg.chat.id,
      `✅ Đã hủy đăng ký thông báo từ \`${repo}\``,
      { parse_mode: 'Markdown' }
    );
  }

  async list(msg) {
    const userId = msg.from.id;
    const subscriptions = this.db.getSubscriptions(userId);

    if (subscriptions.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 'Bạn chưa đăng ký repository nào.');
      return;
    }

    const list = subscriptions.map((s, i) => `${i + 1}. \`${s.repo}\``).join('\n');
    await this.bot.sendMessage(
      msg.chat.id,
      `📋 *Danh sách subscriptions:*\n\n${list}`,
      { parse_mode: 'Markdown' }
    );
  }

  async filter(msg) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🌿 Lọc theo Branch', callback_data: 'filter:branch' }],
        [{ text: '🔧 Lọc theo Workflow', callback_data: 'filter:workflow' }],
        [{ text: '❌ Chỉ nhận thông báo lỗi', callback_data: 'filter:failures' }],
        [{ text: '🗑 Xóa bộ lọc', callback_data: 'filter:clear' }]
      ]
    };

    await this.bot.sendMessage(
      msg.chat.id,
      '⚙️ Chọn loại bộ lọc:',
      { reply_markup: keyboard }
    );
  }

  async stats(msg, repo) {
    const stats = this.db.getWorkflowStats(repo, 7);

    if (stats.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 'Chưa có dữ liệu thống kê cho repository này.');
      return;
    }

    let message = `📊 *Thống kê 7 ngày qua cho ${repo}*\n\n`;

    for (const stat of stats) {
      const successRate = ((stat.success / stat.total) * 100).toFixed(1);
      const avgDuration = Math.round(stat.avg_duration);
      
      message += `🔧 *${stat.workflow}*\n`;
      message += `   Total: ${stat.total} | Success: ${stat.success} | Failed: ${stat.failure}\n`;
      message += `   Success rate: ${successRate}%\n`;
      message += `   Avg duration: ${this.formatDuration(avgDuration)}\n\n`;
    }

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async setQuietHours(msg, startHour, endHour) {
    const userId = msg.from.id;
    const start = parseInt(startHour);
    const end = parseInt(endHour);

    if (start < 0 || start > 23 || end < 0 || end > 23) {
      await this.bot.sendMessage(msg.chat.id, '❌ Giờ phải từ 0-23');
      return;
    }

    this.db.setQuietHours(userId, start, end);
    await this.bot.sendMessage(
      msg.chat.id,
      `🔕 Đã đặt giờ im lặng từ ${start}:00 đến ${end}:00`
    );
  }

  async getLogs(msg, runId) {
    await this.bot.sendMessage(msg.chat.id, '📝 Đang lấy logs...');

    try {
      // Cần parse owner/repo từ context hoặc lưu trong DB
      // Đây là ví dụ đơn giản
      await this.bot.sendMessage(
        msg.chat.id,
        `Xem logs tại: https://github.com/actions/runs/${runId}`
      );
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Không thể lấy logs');
    }
  }

  async toggleJobNotifications(msg, state) {
    const userId = msg.from.id;
    const enabled = state === 'on' ? 1 : 0;

    this.db.setUserSetting(userId, 'notify_jobs', enabled);
    
    const status = enabled ? 'bật' : 'tắt';
    await this.bot.sendMessage(
      msg.chat.id,
      `${enabled ? '🔔' : '🔕'} Đã ${status} thông báo jobs`
    );
  }

  async jobStats(msg, repo, workflow) {
    const stats = this.db.getJobStats(repo, workflow, 7);

    if (stats.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 'Chưa có dữ liệu thống kê jobs cho workflow này.');
      return;
    }

    let message = `📊 *Thống kê Jobs - 7 ngày qua*\n`;
    message += `Repository: \`${repo}\`\n`;
    message += `Workflow: \`${workflow}\`\n\n`;

    for (const stat of stats) {
      const successRate = ((stat.success / stat.total) * 100).toFixed(1);
      const avgDuration = Math.round(stat.avg_duration);
      
      message += `📋 *${stat.job_name}*\n`;
      message += `   Total: ${stat.total} | ✅ ${stat.success} | ❌ ${stat.failure}\n`;
      message += `   Success rate: ${successRate}%\n`;
      message += `   Avg duration: ${this.formatDuration(avgDuration)}\n\n`;
    }

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async handleCallback(query) {
    const [action, ...params] = query.data.split(':');

    switch (action) {
      case 'stats':
        await this.stats({ chat: { id: query.message.chat.id } }, params[0]);
        break;
      case 'jobstats':
        await this.jobStats({ chat: { id: query.message.chat.id } }, params[0], params[1]);
        break;
      case 'logs':
        await this.getLogs({ chat: { id: query.message.chat.id } }, params[0]);
        break;
      case 'viewrun':
        await this.bot.sendMessage(
          query.message.chat.id,
          `🔍 Xem workflow run: https://github.com/actions/runs/${params[0]}`
        );
        break;
      case 'retry':
        await this.retryWorkflow(query, params[0], params[1]);
        break;
      case 'filter':
        await this.handleFilterCallback(query, params[0]);
        break;
    }

    await this.bot.answerCallbackQuery(query.id);
  }

  async retryWorkflow(query, repo, runId) {
    try {
      const [owner, repoName] = repo.split('/');
      await this.octokit.rest.actions.reRunWorkflow({
        owner,
        repo: repoName,
        run_id: runId
      });

      await this.bot.sendMessage(
        query.message.chat.id,
        '🔄 Đã retry workflow thành công!'
      );
    } catch (error) {
      await this.bot.sendMessage(
        query.message.chat.id,
        '❌ Không thể retry workflow. Kiểm tra quyền GitHub token.'
      );
    }
  }

  async handleFilterCallback(query, filterType) {
    // Implement filter configuration flow
    await this.bot.sendMessage(
      query.message.chat.id,
      `Đang cấu hình filter: ${filterType}`
    );
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  }

  // Advanced features
  async setReport(msg, type, state) {
    const userId = msg.from.id;
    const enabled = state === 'on';
    const subscriptions = this.db.getSubscriptions(userId);
    const repos = subscriptions.map(s => s.repo);

    if (type === 'daily') {
      this.db.setReportSettings(userId, enabled, null, repos);
      await this.bot.sendMessage(
        msg.chat.id,
        `${enabled ? '📊' : '🔕'} Báo cáo hàng ngày đã ${enabled ? 'bật' : 'tắt'}`
      );
    } else if (type === 'weekly') {
      this.db.setReportSettings(userId, null, enabled, repos);
      await this.bot.sendMessage(
        msg.chat.id,
        `${enabled ? '📈' : '🔕'} Báo cáo hàng tuần đã ${enabled ? 'bật' : 'tắt'}`
      );
    }
  }

  async addAlert(msg, params) {
    const userId = msg.from.id;
    const parts = params.split(' ');
    
    if (parts.length < 4) {
      await this.bot.sendMessage(
        msg.chat.id,
        'Usage: /alert <repo> <workflow> <duration|failure_rate> <threshold>\n\n' +
        'Ví dụ:\n' +
        '/alert owner/repo CI duration 300 (cảnh báo nếu >5 phút)\n' +
        '/alert owner/repo Tests failure_rate 20 (cảnh báo nếu >20% fail)'
      );
      return;
    }

    const [repo, workflow, ruleType, threshold] = parts;
    
    try {
      this.db.addAlertRule(userId, repo, workflow, ruleType, parseFloat(threshold));
      await this.bot.sendMessage(
        msg.chat.id,
        `🚨 Đã tạo alert rule cho \`${workflow}\` trong \`${repo}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Lỗi khi tạo alert rule');
    }
  }

  async listAlerts(msg) {
    const userId = msg.from.id;
    const alerts = this.db.getAlertRules(userId);

    if (alerts.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 'Bạn chưa có alert rule nào.');
      return;
    }

    let message = '🚨 *Alert Rules:*\n\n';
    for (const alert of alerts) {
      message += `${alert.id}. \`${alert.repo}\` - ${alert.workflow}\n`;
      message += `   Type: ${alert.rule_type}, Threshold: ${alert.threshold}\n\n`;
    }

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async getCost(msg, repo) {
    const costTracker = new (await import('./cost-tracker.js')).CostTracker(this.bot, this.db);
    const report = await costTracker.getCostReport(repo, 30);

    if (!report) {
      await this.bot.sendMessage(msg.chat.id, 'Chưa có dữ liệu chi phí cho repository này.');
      return;
    }

    let message = `💰 *Chi phí 30 ngày qua - ${repo}*\n\n`;
    message += `💵 Tổng chi phí: $${report.totalCost}\n`;
    message += `⏱ Tổng thời gian: ${report.totalMinutes} phút\n\n`;
    message += '*Top workflows:*\n';

    for (const w of report.byWorkflow.slice(0, 10)) {
      message += `  ${w.workflow}: $${w.cost} (${w.runs} runs)\n`;
    }

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async getDeployments(msg, repo) {
    const deployments = this.db.getDeployments(repo, 7);

    if (deployments.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 'Chưa có deployment nào trong 7 ngày qua.');
      return;
    }

    let message = `🚀 *Deployments - 7 ngày qua*\n\`${repo}\`\n\n`;

    for (const d of deployments) {
      const emoji = d.status === 'success' ? '✅' : d.status === 'failure' ? '❌' : '⏳';
      message += `${emoji} ${d.environment} - ${d.ref}\n`;
      message += `   By: ${d.creator} | ${new Date(d.timestamp).toLocaleDateString()}\n\n`;
    }

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async manageTeamChannel(msg, action, repo) {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;

    if (chatType === 'private') {
      await this.bot.sendMessage(chatId, '❌ Command này chỉ dùng trong group/channel');
      return;
    }

    if (action === 'add') {
      this.db.addTeamChannel(chatId, repo, chatType);
      await this.bot.sendMessage(
        chatId,
        `✅ Channel này sẽ nhận thông báo từ \`${repo}\``,
        { parse_mode: 'Markdown' }
      );
    } else if (action === 'remove') {
      this.db.removeTeamChannel(chatId, repo);
      await this.bot.sendMessage(
        chatId,
        `✅ Đã hủy thông báo từ \`${repo}\``,
        { parse_mode: 'Markdown' }
      );
    }
  }
}
