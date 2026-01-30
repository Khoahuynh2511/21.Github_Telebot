import crypto from 'crypto';

export class WebhookHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
  }

  verifySignature(payload, signature) {
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  handle(req, res) {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (!this.verifySignature(JSON.stringify(req.body), signature)) {
      return res.status(401).send('Invalid signature');
    }

    if (event === 'workflow_run') {
      this.handleWorkflowRun(req.body);
    } else if (event === 'workflow_job') {
      this.handleWorkflowJob(req.body);
    }

    res.status(200).send('OK');
  }

  async handleWorkflowRun(payload) {
    const { action, workflow_run, repository } = payload;

    if (action !== 'completed') return;

    const repo = repository.full_name;
    const workflow = workflow_run.name;
    const status = workflow_run.conclusion;
    const branch = workflow_run.head_branch;
    const actor = workflow_run.actor.login;
    const runId = workflow_run.id;
    const url = workflow_run.html_url;
    const duration = Math.round((new Date(workflow_run.updated_at) - new Date(workflow_run.created_at)) / 1000);

    // Lưu stats
    this.db.addWorkflowStat(repo, workflow, status, duration);

    // Lấy danh sách users đăng ký
    const users = this.db.getUsersForRepo(repo);

    for (const { user_id } of users) {
      // Kiểm tra quiet hours
      if (this.db.isQuietTime(user_id)) continue;

      // Kiểm tra filter
      const filter = this.db.getFilter(user_id, repo);
      if (filter) {
        if (filter.branch && filter.branch !== branch) continue;
        if (filter.workflow && filter.workflow !== workflow) continue;
        if (filter.only_failures && status === 'success') continue;
      }

      await this.sendNotification(user_id, {
        repo,
        workflow,
        status,
        branch,
        actor,
        runId,
        url,
        duration,
        commit: workflow_run.head_commit
      });
    }
  }

  async sendNotification(userId, data) {
    const emoji = data.status === 'success' ? '✅' : '❌';
    const statusText = data.status === 'success' ? 'thành công' : 'thất bại';

    const message = `
${emoji} *Workflow ${statusText}*

📦 Repository: \`${data.repo}\`
🔧 Workflow: \`${data.workflow}\`
🌿 Branch: \`${data.branch}\`
👤 Actor: ${data.actor}
⏱ Duration: ${this.formatDuration(data.duration)}

💬 Commit: ${data.commit?.message || 'N/A'}

[Xem chi tiết](${data.url})
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 Stats', callback_data: `stats:${data.repo}` },
          { text: '📝 Logs', callback_data: `logs:${data.runId}` }
        ]
      ]
    };

    // Thêm nút retry nếu failed
    if (data.status === 'failure') {
      keyboard.inline_keyboard[0].push(
        { text: '🔄 Retry', callback_data: `retry:${data.repo}:${data.runId}` }
      );
    }

    try {
      // Send to subscribed users
      await this.bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error(`Failed to send message to ${userId}:`, error.message);
    }

    // Send to team channels
    const teamChannels = this.db.getTeamChannels(data.repo);
    for (const { chat_id } of teamChannels) {
      try {
        await this.bot.sendMessage(chat_id, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          disable_web_page_preview: true
        });
      } catch (error) {
        console.error(`Failed to send to team channel ${chat_id}:`, error.message);
      }
    }
  }

  async handleWorkflowJob(payload) {
    const { action, workflow_job, repository } = payload;

    if (action !== 'completed') return;

    const repo = repository.full_name;
    const workflow = workflow_job.workflow_name;
    const jobName = workflow_job.name;
    const status = workflow_job.conclusion;
    const runId = workflow_job.run_id;
    const url = workflow_job.html_url;
    const duration = Math.round((new Date(workflow_job.completed_at) - new Date(workflow_job.started_at)) / 1000);

    // Lưu job stats
    this.db.addJobStat(repo, workflow, jobName, status, duration);

    // Lấy users có bật thông báo jobs
    const users = this.db.getUsersForRepo(repo);

    for (const { user_id } of users) {
      // Kiểm tra user có muốn nhận thông báo jobs không
      const notifyJobs = this.db.getUserSetting(user_id, 'notify_jobs');
      if (!notifyJobs) continue;

      // Kiểm tra quiet hours
      if (this.db.isQuietTime(user_id)) continue;

      // Kiểm tra filter
      const filter = this.db.getFilter(user_id, repo);
      if (filter && filter.only_failures && status === 'success') continue;

      await this.sendJobNotification(user_id, {
        repo,
        workflow,
        jobName,
        status,
        runId,
        url,
        duration,
        steps: workflow_job.steps
      });
    }
  }

  async sendJobNotification(userId, data) {
    const emoji = data.status === 'success' ? '✅' : '❌';
    const statusText = data.status === 'success' ? 'thành công' : 'thất bại';

    // Tìm step bị lỗi (nếu có)
    const failedSteps = data.steps?.filter(s => s.conclusion === 'failure') || [];
    const failedStepInfo = failedSteps.length > 0 
      ? `\n❗ Failed steps: ${failedSteps.map(s => s.name).join(', ')}`
      : '';

    const message = `
${emoji} *Job ${statusText}*

📦 Repository: \`${data.repo}\`
🔧 Workflow: \`${data.workflow}\`
📋 Job: \`${data.jobName}\`
⏱ Duration: ${this.formatDuration(data.duration)}${failedStepInfo}

[Xem chi tiết](${data.url})
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 Job Stats', callback_data: `jobstats:${data.repo}:${data.workflow}` },
          { text: '🔍 View Run', callback_data: `viewrun:${data.runId}` }
        ]
      ]
    };

    try {
      await this.bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error(`Failed to send job notification to ${userId}:`, error.message);
    }
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  }
}
