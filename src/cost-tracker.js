export class CostTracker {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    
    // GitHub Actions pricing (per minute)
    this.pricing = {
      'ubuntu': 0.008,
      'windows': 0.016,
      'macos': 0.08,
      'ubuntu-4core': 0.016,
      'ubuntu-8core': 0.032,
      'ubuntu-16core': 0.064
    };
  }

  calculateCost(runnerType, durationSeconds) {
    const minutes = Math.ceil(durationSeconds / 60);
    const pricePerMinute = this.pricing[runnerType] || this.pricing['ubuntu'];
    return minutes * pricePerMinute;
  }

  async trackWorkflowCost(payload) {
    const { workflow_run, repository } = payload;
    
    const repo = repository.full_name;
    const workflow = workflow_run.name;
    const duration = Math.round(
      (new Date(workflow_run.updated_at) - new Date(workflow_run.created_at)) / 1000
    );

    // Estimate runner type from workflow
    const runnerType = this.estimateRunnerType(workflow_run);
    const cost = this.calculateCost(runnerType, duration);

    this.db.addCostRecord(repo, workflow, runnerType, duration, cost);
  }

  estimateRunnerType(workflowRun) {
    // Simple heuristic - can be improved with actual runner info
    const name = workflowRun.name.toLowerCase();
    
    if (name.includes('macos') || name.includes('ios')) return 'macos';
    if (name.includes('windows')) return 'windows';
    return 'ubuntu';
  }

  async getCostReport(repo, days = 30) {
    const costs = this.db.getCostStats(repo, days);
    
    if (costs.length === 0) return null;

    const totalCost = costs.reduce((sum, c) => sum + c.total_cost, 0);
    const totalMinutes = costs.reduce((sum, c) => sum + c.total_minutes, 0);

    return {
      totalCost: totalCost.toFixed(2),
      totalMinutes: Math.round(totalMinutes),
      byWorkflow: costs.map(c => ({
        workflow: c.workflow,
        cost: c.total_cost.toFixed(2),
        minutes: Math.round(c.total_minutes),
        runs: c.run_count
      }))
    };
  }

  async sendCostAlert(userId, repo, threshold) {
    const report = await this.getCostReport(repo, 30);
    
    if (!report || parseFloat(report.totalCost) < threshold) return;

    const message = `
💰 *Cost Alert*

Repository \`${repo}\` đã vượt ngưỡng chi phí!

💵 Chi phí tháng này: $${report.totalCost}
⚠️ Ngưỡng cảnh báo: $${threshold}
⏱ Tổng thời gian: ${report.totalMinutes} phút

*Top workflows:*
${report.byWorkflow.slice(0, 5).map(w => 
  `  ${w.workflow}: $${w.cost} (${w.runs} runs)`
).join('\n')}
    `.trim();

    try {
      await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Failed to send cost alert to ${userId}:`, error.message);
    }
  }
}
