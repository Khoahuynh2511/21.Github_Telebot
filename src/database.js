import Database from 'better-sqlite3';

export class Database {
  constructor() {
    this.db = new Database('bot.db');
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        repo TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, repo)
      );

      CREATE TABLE IF NOT EXISTS filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        repo TEXT,
        branch TEXT,
        workflow TEXT,
        only_failures BOOLEAN DEFAULT 0,
        UNIQUE(user_id, repo)
      );

      CREATE TABLE IF NOT EXISTS quiet_hours (
        user_id INTEGER PRIMARY KEY,
        start_hour INTEGER NOT NULL,
        end_hour INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo TEXT NOT NULL,
        workflow TEXT NOT NULL,
        status TEXT NOT NULL,
        duration INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        is_admin BOOLEAN DEFAULT 0,
        notifications_enabled BOOLEAN DEFAULT 1,
        timezone TEXT DEFAULT 'UTC',
        notify_jobs BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS job_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo TEXT NOT NULL,
        workflow TEXT NOT NULL,
        job_name TEXT NOT NULL,
        status TEXT NOT NULL,
        duration INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS report_settings (
        user_id INTEGER PRIMARY KEY,
        daily_report BOOLEAN DEFAULT 0,
        weekly_report BOOLEAN DEFAULT 0,
        repos TEXT
      );

      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        repo TEXT NOT NULL,
        workflow TEXT,
        rule_type TEXT NOT NULL,
        threshold REAL NOT NULL,
        enabled BOOLEAN DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id INTEGER,
        repo TEXT NOT NULL,
        environment TEXT NOT NULL,
        ref TEXT NOT NULL,
        creator TEXT,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cost_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo TEXT NOT NULL,
        workflow TEXT NOT NULL,
        runner_type TEXT NOT NULL,
        duration INTEGER NOT NULL,
        cost REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS team_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        repo TEXT NOT NULL,
        chat_type TEXT NOT NULL,
        UNIQUE(chat_id, repo)
      );
    `);
  }

  // Subscriptions
  addSubscription(userId, repo) {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, repo) VALUES (?, ?)');
    return stmt.run(userId, repo);
  }

  removeSubscription(userId, repo) {
    const stmt = this.db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND repo = ?');
    return stmt.run(userId, repo);
  }

  getSubscriptions(userId) {
    const stmt = this.db.prepare('SELECT repo FROM subscriptions WHERE user_id = ?');
    return stmt.all(userId);
  }

  getUsersForRepo(repo) {
    const stmt = this.db.prepare('SELECT user_id FROM subscriptions WHERE repo = ?');
    return stmt.all(repo);
  }

  // Filters
  setFilter(userId, repo, options) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO filters (user_id, repo, branch, workflow, only_failures)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, repo, options.branch, options.workflow, options.onlyFailures ? 1 : 0);
  }

  getFilter(userId, repo) {
    const stmt = this.db.prepare('SELECT * FROM filters WHERE user_id = ? AND repo = ?');
    return stmt.get(userId, repo);
  }

  // Quiet hours
  setQuietHours(userId, startHour, endHour) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO quiet_hours (user_id, start_hour, end_hour)
      VALUES (?, ?, ?)
    `);
    return stmt.run(userId, startHour, endHour);
  }

  getQuietHours(userId) {
    const stmt = this.db.prepare('SELECT * FROM quiet_hours WHERE user_id = ?');
    return stmt.get(userId);
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
    const stmt = this.db.prepare(`
      INSERT INTO workflow_stats (repo, workflow, status, duration)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(repo, workflow, status, duration);
  }

  getWorkflowStats(repo, days = 7) {
    const stmt = this.db.prepare(`
      SELECT 
        workflow,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
        AVG(duration) as avg_duration
      FROM workflow_stats
      WHERE repo = ? AND timestamp > datetime('now', '-' || ? || ' days')
      GROUP BY workflow
    `);
    return stmt.all(repo, days);
  }

  // User settings
  setUserSetting(userId, setting, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, ${setting})
      VALUES (?, ?)
    `);
    return stmt.run(userId, value);
  }

  getUserSetting(userId, setting) {
    const stmt = this.db.prepare(`SELECT ${setting} FROM user_settings WHERE user_id = ?`);
    const result = stmt.get(userId);
    return result ? result[setting] : null;
  }

  // Job stats
  addJobStat(repo, workflow, jobName, status, duration) {
    const stmt = this.db.prepare(`
      INSERT INTO job_stats (repo, workflow, job_name, status, duration)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(repo, workflow, jobName, status, duration);
  }

  getJobStats(repo, workflow, days = 7) {
    const stmt = this.db.prepare(`
      SELECT 
        job_name,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
        AVG(duration) as avg_duration
      FROM job_stats
      WHERE repo = ? AND workflow = ? AND timestamp > datetime('now', '-' || ? || ' days')
      GROUP BY job_name
    `);
    return stmt.all(repo, workflow, days);
  }
}

  // Report settings
  setReportSettings(userId, daily, weekly, repos) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO report_settings (user_id, daily_report, weekly_report, repos)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(userId, daily ? 1 : 0, weekly ? 1 : 0, JSON.stringify(repos));
  }

  getUsersWithDailyReport() {
    const stmt = this.db.prepare('SELECT user_id, repos FROM report_settings WHERE daily_report = 1');
    return stmt.all();
  }

  getUsersWithWeeklyReport() {
    const stmt = this.db.prepare('SELECT user_id, repos FROM report_settings WHERE weekly_report = 1');
    return stmt.all();
  }

  // Alert rules
  addAlertRule(userId, repo, workflow, ruleType, threshold) {
    const stmt = this.db.prepare(`
      INSERT INTO alert_rules (user_id, repo, workflow, rule_type, threshold)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, repo, workflow, ruleType, threshold);
  }

  getAllAlertRules() {
    const stmt = this.db.prepare('SELECT * FROM alert_rules WHERE enabled = 1');
    return stmt.all();
  }

  getAlertRules(userId) {
    const stmt = this.db.prepare('SELECT * FROM alert_rules WHERE user_id = ?');
    return stmt.all(userId);
  }

  deleteAlertRule(ruleId) {
    const stmt = this.db.prepare('DELETE FROM alert_rules WHERE id = ?');
    return stmt.run(ruleId);
  }

  getRecentWorkflowRuns(repo, workflow, limit = 5) {
    const stmt = this.db.prepare(`
      SELECT status, duration FROM workflow_stats
      WHERE repo = ? AND workflow = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(repo, workflow, limit);
  }

  // Deployments
  addDeployment(repo, environment, ref, creator, status) {
    const stmt = this.db.prepare(`
      INSERT INTO deployments (repo, environment, ref, creator, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(repo, environment, ref, creator, status);
  }

  updateDeploymentStatus(deploymentId, status) {
    const stmt = this.db.prepare('UPDATE deployments SET status = ? WHERE deployment_id = ?');
    return stmt.run(status, deploymentId);
  }

  getDeployments(repo, days = 7) {
    const stmt = this.db.prepare(`
      SELECT * FROM deployments
      WHERE repo = ? AND timestamp > datetime('now', '-' || ? || ' days')
      ORDER BY timestamp DESC
    `);
    return stmt.all(repo, days);
  }

  // Cost tracking
  addCostRecord(repo, workflow, runnerType, duration, cost) {
    const stmt = this.db.prepare(`
      INSERT INTO cost_records (repo, workflow, runner_type, duration, cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(repo, workflow, runnerType, duration, cost);
  }

  getCostStats(repo, days = 30) {
    const stmt = this.db.prepare(`
      SELECT 
        workflow,
        SUM(cost) as total_cost,
        SUM(duration) / 60.0 as total_minutes,
        COUNT(*) as run_count
      FROM cost_records
      WHERE repo = ? AND timestamp > datetime('now', '-' || ? || ' days')
      GROUP BY workflow
      ORDER BY total_cost DESC
    `);
    return stmt.all(repo, days);
  }

  // Team channels
  addTeamChannel(chatId, repo, chatType) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO team_channels (chat_id, repo, chat_type)
      VALUES (?, ?, ?)
    `);
    return stmt.run(chatId, repo, chatType);
  }

  getTeamChannels(repo) {
    const stmt = this.db.prepare('SELECT chat_id FROM team_channels WHERE repo = ?');
    return stmt.all(repo);
  }

  removeTeamChannel(chatId, repo) {
    const stmt = this.db.prepare('DELETE FROM team_channels WHERE chat_id = ? AND repo = ?');
    return stmt.run(chatId, repo);
  }
}
