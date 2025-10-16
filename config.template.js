// Configuration template for local development
// Copy this file to config.js and fill in your deployment values
// config.js is gitignored and won't be committed

window.deploymentConfig = {
    // API Gateway URL from your deployment
    // Get this from deployment-outputs.json after running ./deploy.sh
    apiBaseUrl: 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod',
    
    // Glean Agent IDs (optional - only if using embedded Glean agents)
    gleanIntakeAgentId: 'your-glean-agent-id',
    gleanReviewAgentId: 'your-glean-agent-id',
    
    // Auth token (for demo purposes - in production use proper auth)
    authToken: 'demo-token-123'
};
