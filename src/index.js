import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { WebhookHandler } from './webhook.js';
import { BotCommands } from './commands.js';
import { Database } from './database-memory.js'; // Dùng in-memory database
import { Scheduler } from './scheduler.js';
import { DeploymentTracker } from './deployment.js';
import { CostTracker } from './cost-tracker.js';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const app = express();
const db = new Database();

app.use(express.json());

// Khởi tạo handlers
const webhookHandler = new WebhookHandler(bot, db);
const botCommands = new BotCommands(bot, db);
const scheduler = new Scheduler(bot, db);
const deploymentTracker = new DeploymentTracker(bot, db);
const costTracker = new CostTracker(bot, db);

// Start scheduler
scheduler.start();

// Webhook endpoint
app.post('/webhook/github', (req, res) => {
  const event = req.headers['x-github-event'];
  
  if (event === 'deployment') {
    deploymentTracker.handleDeployment(req.body);
  } else if (event === 'deployment_status') {
    deploymentTracker.handleDeploymentStatus(req.body);
  } else if (event === 'workflow_run') {
    costTracker.trackWorkflowCost(req.body);
  }
  
  webhookHandler.handle(req, res);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Bot commands
bot.onText(/\/start/, (msg) => botCommands.start(msg));
bot.onText(/\/info/, (msg) => botCommands.info(msg));
bot.onText(/\/help/, (msg) => botCommands.help(msg));
bot.onText(/\/subscribe (.+)/, (msg, match) => botCommands.subscribe(msg, match[1]));
bot.onText(/\/unsubscribe (.+)/, (msg, match) => botCommands.unsubscribe(msg, match[1]));
bot.onText(/\/list/, (msg) => botCommands.list(msg));
bot.onText(/\/filter/, (msg) => botCommands.filter(msg));
bot.onText(/\/stats (.+)/, (msg, match) => botCommands.stats(msg, match[1]));
bot.onText(/\/jobstats (.+) (.+)/, (msg, match) => botCommands.jobStats(msg, match[1], match[2]));
bot.onText(/\/quiet (\d+) (\d+)/, (msg, match) => botCommands.setQuietHours(msg, match[1], match[2]));
bot.onText(/\/notifyjobs (on|off)/, (msg, match) => botCommands.toggleJobNotifications(msg, match[1]));
bot.onText(/\/logs (\d+)/, (msg, match) => botCommands.getLogs(msg, match[1]));
bot.onText(/\/report (daily|weekly) (on|off)/, (msg, match) => botCommands.setReport(msg, match[1], match[2]));
bot.onText(/\/alert (.+)/, (msg, match) => botCommands.addAlert(msg, match[1]));
bot.onText(/\/alerts/, (msg) => botCommands.listAlerts(msg));
bot.onText(/\/cost (.+)/, (msg, match) => botCommands.getCost(msg, match[1]));
bot.onText(/\/deployments (.+)/, (msg, match) => botCommands.getDeployments(msg, match[1]));
bot.onText(/\/teamchannel (add|remove) (.+)/, (msg, match) => botCommands.manageTeamChannel(msg, match[1], match[2]));

// Callback queries cho inline buttons
bot.on('callback_query', (query) => botCommands.handleCallback(query));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Bot started successfully`);
});
