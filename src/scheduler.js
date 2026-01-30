import cron from 'node-cron';

export class Scheduler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.jobs = new Map();
  }

  start() {
    // Daily report - 9:00 AM
    cron.schedule('0 9 * * *', () => {
      this.sendDailyReports();
    });

    // Weekly report - Monday 9:00 AM
    cron.schedule('0 9 * * 1', () => {
      this.sendWeeklyReports();
    });

    // Check alert rules every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkAlertRules();
    });

    console.log('📅 Scheduler started');
  }

  async sendDailyReports() {
    const users = this.db.getUsersWithDailyReport();

    for (const { user_id, repos } of users) {
      const repoList = JSON.parse(repos);
      let report = '📊 *Báo cáo hàng ngày*\n\n';

      for (const repo of repoList) {
        const stats = this.db.getWorkflowStats(repo, 1);
        if (stats.length === 0) continue;

        report += `📦 *${repo}*\n`;
        for (const stat of stats) {
          const successRate = ((stat.success / stat.total) * 100).toFixed(1);
          report += `  ${stat.workflow}: ${stat.total} runs, ${successRate}% success\n`;
        }
        report += '\n';
      }

      try {
        await this.bot.sendMessage(user_id, report, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to send daily report to ${user_id}:`, error.message);
      }
    }
  }

  async sendWeeklyReports() {
    const users = this.db.getUsersWithWeeklyReport();

    for (const { user_id, repos } of users) {
      const repoList = JSON.parse(repos);
      let report = '📈 *Báo cáo tuần này*\n\n';

      for (const repo of repoList) {
        const stats = this.db.getWorkflowStats(repo, 7);
        const deployments = this.db.getDeployments(repo, 7);
        
        if (stats.length === 0) continue;

        report += `📦 *${repo}*\n\n`;
        
        // Workflow stats
        report += '*Workflows:*\n';
        for (const stat of stats) {
          const successRate = ((stat.success / stat.total) * 100).toFixed(1);
          const trend = this.calculateTrend(repo, stat.workflow);
          report += `  ${stat.workflow}: ${successRate}% ${trend}\n`;
        }

        // Deployments
        if (deployments.length > 0) {
          report += `\n*Deployments:* ${deployments.length} lần\n`;
        }

        report += '\n';
      }

      try {
        await this.bot.sendMessage(user_id, report, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to send weekly report to ${user_id}:`, error.message);
      }
    }
  }

  async checkAlertRules() {
    const rules = this.db.getAllAlertRules();

    for (const rule of rules) {
      const recentRuns = this.db.getRecentWorkflowRuns(rule.repo, rule.workflow, 5);
      
      if (rule.rule_type === 'duration' && recentRuns.length > 0) {
        const avgDuration = recentRuns.reduce((sum, r) => sum + r.duration, 0) / recentRuns.length;
        
        if (avgDuration > rule.threshold) {
          await this.sendAlert(rule.user_id, {
            type: 'duration',
            repo: rule.repo,
            workflow: rule.workflow,
            avgDuration,
            threshold: rule.threshold
          });
        }
      }

      if (rule.rule_type === 'failure_rate' && recentRuns.length >= 5) {
        const failures = recentRuns.filter(r => r.status === 'failure').length;
        const failureRate = (failures / recentRuns.length) * 100;

        if (failureRate > rule.threshold) {
          await this.sendAlert(rule.user_id, {
            type: 'failure_rate',
            repo: rule.repo,
            workflow: rule.workflow,
            failureRate,
            threshold: rule.threshold
          });
        }
      }
    }
  }

  async sendAlert(userId, data) {
    let message = '🚨 *ALERT*\n\n';

    if (data.type === 'duration') {
      message += `Workflow \`${data.workflow}\` trong \`${data.repo}\` đang chạy chậm!\n\n`;
      message += `⏱ Thời gian trung bình: ${Math.round(data.avgDuration)}s\n`;
      message += `⚠️ Ngưỡng cảnh báo: ${data.threshold}s`;
    } else if (data.type === 'failure_rate') {
      message += `Workflow \`${data.workflow}\` trong \`${data.repo}\` có tỷ lệ lỗi cao!\n\n`;
      message += `❌ Failure rate: ${data.failureRate.toFixed(1)}%\n`;
      message += `⚠️ Ngưỡng cảnh báo: ${data.threshold}%`;
    }

    try {
      await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Failed to send alert to ${userId}:`, error.message);
    }
  }

  calculateTrend(repo, workflow) {
    const thisWeek = this.db.getWorkflowStats(repo, 7);
    const lastWeek = this.db.getWorkflowStats(repo, 14);

    const thisWeekStat = thisWeek.find(s => s.workflow === workflow);
    const lastWeekStat = lastWeek.find(s => s.workflow === workflow);

    if (!thisWeekStat || !lastWeekStat) return '';

    const thisRate = (thisWeekStat.success / thisWeekStat.total) * 100;
    const lastRate = (lastWeekStat.success / lastWeekStat.total) * 100;

    if (thisRate > lastRate + 5) return '📈';
    if (thisRate < lastRate - 5) return '📉';
    return '➡️';
  }
}
