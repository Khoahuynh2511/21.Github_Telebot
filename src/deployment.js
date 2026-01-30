export class DeploymentTracker {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
  }

  async handleDeployment(payload) {
    const { deployment, repository } = payload;
    
    const repo = repository.full_name;
    const environment = deployment.environment;
    const ref = deployment.ref;
    const creator = deployment.creator.login;
    const url = deployment.url;

    this.db.addDeployment(repo, environment, ref, creator, 'pending');

    // Notify users
    const users = this.db.getUsersForRepo(repo);
    
    for (const { user_id } of users) {
      const notifyDeployments = this.db.getUserSetting(user_id, 'notify_deployments');
      if (!notifyDeployments) continue;

      await this.sendDeploymentNotification(user_id, {
        repo,
        environment,
        ref,
        creator,
        status: 'started'
      });
    }
  }

  async handleDeploymentStatus(payload) {
    const { deployment_status, deployment, repository } = payload;
    
    const repo = repository.full_name;
    const environment = deployment.environment;
    const status = deployment_status.state;
    const url = deployment_status.target_url;

    this.db.updateDeploymentStatus(deployment.id, status);

    if (status === 'success' || status === 'failure') {
      const users = this.db.getUsersForRepo(repo);
      
      for (const { user_id } of users) {
        const notifyDeployments = this.db.getUserSetting(user_id, 'notify_deployments');
        if (!notifyDeployments) continue;

        await this.sendDeploymentNotification(user_id, {
          repo,
          environment,
          ref: deployment.ref,
          status,
          url
        });
      }
    }
  }

  async sendDeploymentNotification(userId, data) {
    let emoji = '🚀';
    let statusText = 'đang deploy';

    if (data.status === 'success') {
      emoji = '✅';
      statusText = 'deploy thành công';
    } else if (data.status === 'failure') {
      emoji = '❌';
      statusText = 'deploy thất bại';
    }

    const message = `
${emoji} *Deployment ${statusText}*

📦 Repository: \`${data.repo}\`
🌍 Environment: \`${data.environment}\`
🌿 Ref: \`${data.ref}\`
${data.creator ? `👤 By: ${data.creator}` : ''}

${data.url ? `[Xem chi tiết](${data.url})` : ''}
    `.trim();

    try {
      await this.bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error(`Failed to send deployment notification to ${userId}:`, error.message);
    }
  }
}
