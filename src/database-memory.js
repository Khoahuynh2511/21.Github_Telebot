export class Database {
  constructor() {
    this.subscriptions = new Map();
    this.filters = new Map();
    this.quietHours = new Map();
    this.stats = [];
    this.jobStats = [];
    this.userSettings = new Map();
    this.reportSettings = new Map();
    this.alertRules = [];
    this.deployments = [];
    this.costRecords = [];
    this.teamChannels = new Map();
  }

  init() {
    console.log('📦 Using in-memory database (data will be lost on restart)');
  }

  // Subscriptions
  addSubscription(userId, repo) {
    const key = `${userId}:${repo}`;
    this.subscriptions.set(key, { userId, repo, createdAt: new Date() });
  }

  removeSubscription(userId, repo) {
    const key = `${userId}:${repo}`;
    this.subscriptions.delete(key);
  }

  getSubscriptions(userId) {
    const result = [];
    for (const [key, value] of this.subscriptions) {
      if (value.userId === userId) {
        result.push({ repo: value.repo });
      }
    }
    return result;
  }

  getUsersForRepo(repo) {
    const result = [];
    for (const [key, value] of this.subscriptions) {
      if (value.repo === repo) {
        result.push({ user_id: value.userId });
      }
    }
    return result;
  }

  // Filters
  setFilter(userId, repo, options) {
    const key = `${userId}:${repo}`;
    this.filters.set(key, { ...options, userId, repo });
  }

  getFilter(userId, repo) {
    const key = `${userId}:${repo}`;
    return this.filters.get(key) || null;
  }

  // Quiet hours
  setQuietHours(userId, startHour, endHour) {
    this.quietHours.set(userId, { start_hour: startHour, end_hour: endHour });
  }

  getQuietHours(userId) {
    return this.quietHours.get(userId) || null;
  }

  isQuietTime(userId) {
    const quietHours = this.getQuietHours(userId);
    if (!quietHours) return false;

    const now = new Date().getHours();
    const { start_hour, end_hour } = quietHours;

    if (start_hour < end_hour) {
      return now >= start_hour && now < end_hour;
    } else {
      return now >= start_hour || now < end_hour;
    }
  }

  // Stats
  addWorkflowStat(repo, workflow, status, duration) {
    this.stats.push({
      repo,
      workflow,
      status,
      duration,
      timestamp: new Date()
    });
  }

  getWorkflowStats(repo, days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.stats.filter(s => 
      s.repo === repo && s.timestamp > cutoff
    );

    const grouped = {};
    for (const stat of filtered) {
      if (!grouped[stat.workflow]) {
        grouped[stat.workflow] = {
          workflow: stat.workflow,
          total: 0,
          success: 0,
          failure: 0,
          durations: []
        };
      }
      grouped[stat.workflow].total++;
      if (stat.status === 'success') grouped[stat.workflow].success++;
      if (stat.status === 'failure') grouped[stat.workflow].failure++;
      grouped[stat.workflow].durations.push(stat.duration);
    }

    return Object.values(grouped).map(g => ({
      ...g,
      avg_duration: g.durations.reduce((a, b) => a + b, 0) / g.durations.length
    }));
  }

  // User settings
  setUserSetting(userId, setting, value) {
    const settings = this.userSettings.get(userId) || {};
    settings[setting] = value;
    this.userSettings.set(userId, settings);
  }

  getUserSetting(userId, setting) {
    const settings = this.userSettings.get(userId);
    return settings ? settings[setting] : null;
  }

  // Job stats
  addJobStat(repo, workflow, jobName, status, duration) {
    this.jobStats.push({
      repo,
      workflow,
      job_name: jobName,
      status,
      duration,
      timestamp: new Date()
    });
  }

  getJobStats(repo, workflow, days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.jobStats.filter(s => 
      s.repo === repo && s.workflow === workflow && s.timestamp > cutoff
    );

    const grouped = {};
    for (const stat of filtered) {
      if (!grouped[stat.job_name]) {
        grouped[stat.job_name] = {
          job_name: stat.job_name,
          total: 0,
          success: 0,
          failure: 0,
          durations: []
        };
      }
      grouped[stat.job_name].total++;
      if (stat.status === 'success') grouped[stat.job_name].success++;
      if (stat.status === 'failure') grouped[stat.job_name].failure++;
      grouped[stat.job_name].durations.push(stat.duration);
    }

    return Object.values(grouped).map(g => ({
      ...g,
      avg_duration: g.durations.reduce((a, b) => a + b, 0) / g.durations.length
    }));
  }

  // Report settings
  setReportSettings(userId, daily, weekly, repos) {
    this.reportSettings.set(userId, { daily, weekly, repos });
  }

  getUsersWithDailyReport() {
    const result = [];
    for (const [userId, settings] of this.reportSettings) {
      if (settings.daily) {
        result.push({ user_id: userId, repos: JSON.stringify(settings.repos) });
      }
    }
    return result;
  }

  getUsersWithWeeklyReport() {
    const result = [];
    for (const [userId, settings] of this.reportSettings) {
      if (settings.weekly) {
        result.push({ user_id: userId, repos: JSON.stringify(settings.repos) });
      }
    }
    return result;
  }

  // Alert rules
  addAlertRule(userId, repo, workflow, ruleType, threshold) {
    this.alertRules.push({
      id: this.alertRules.length + 1,
      user_id: userId,
      repo,
      workflow,
      rule_type: ruleType,
      threshold,
      enabled: 1
    });
  }

  getAllAlertRules() {
    return this.alertRules.filter(r => r.enabled);
  }

  getAlertRules(userId) {
    return this.alertRules.filter(r => r.user_id === userId);
  }

  deleteAlertRule(ruleId) {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index > -1) this.alertRules.splice(index, 1);
  }

  getRecentWorkflowRuns(repo, workflow, limit = 5) {
    return this.stats
      .filter(s => s.repo === repo && s.workflow === workflow)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Deployments
  addDeployment(repo, environment, ref, creator, status) {
    this.deployments.push({
      id: this.deployments.length + 1,
      deployment_id: null,
      repo,
      environment,
      ref,
      creator,
      status,
      timestamp: new Date()
    });
  }

  updateDeploymentStatus(deploymentId, status) {
    const deployment = this.deployments.find(d => d.deployment_id === deploymentId);
    if (deployment) deployment.status = status;
  }

  getDeployments(repo, days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.deployments
      .filter(d => d.repo === repo && d.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Cost tracking
  addCostRecord(repo, workflow, runnerType, duration, cost) {
    this.costRecords.push({
      repo,
      workflow,
      runner_type: runnerType,
      duration,
      cost,
      timestamp: new Date()
    });
  }

  getCostStats(repo, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.costRecords.filter(c => 
      c.repo === repo && c.timestamp > cutoff
    );

    const grouped = {};
    for (const record of filtered) {
      if (!grouped[record.workflow]) {
        grouped[record.workflow] = {
          workflow: record.workflow,
          total_cost: 0,
          total_minutes: 0,
          run_count: 0
        };
      }
      grouped[record.workflow].total_cost += record.cost;
      grouped[record.workflow].total_minutes += record.duration / 60;
      grouped[record.workflow].run_count++;
    }

    return Object.values(grouped);
  }

  // Team channels
  addTeamChannel(chatId, repo, chatType) {
    const key = `${chatId}:${repo}`;
    this.teamChannels.set(key, { chat_id: chatId, repo, chat_type: chatType });
  }

  getTeamChannels(repo) {
    const result = [];
    for (const [key, value] of this.teamChannels) {
      if (value.repo === repo) {
        result.push({ chat_id: value.chat_id });
      }
    }
    return result;
  }

  removeTeamChannel(chatId, repo) {
    const key = `${chatId}:${repo}`;
    this.teamChannels.delete(key);
  }
}
