/**
 * Submitter Portal Logic
 * Handles claim submission via Glean Agent
 */

// Global state
let gleanChatInitialized = false;
let currentIntent = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Submitter portal initializing...');
    
    // Load saved agent ID
    loadAgentId();
    
    // Don't auto-initialize chat - wait for user selection
});

/**
 * Load agent ID from localStorage or config
 */
function loadAgentId() {
    const savedAgentId = localStorage.getItem('glean_agent_id');
    const agentIdInput = document.getElementById('agent-id-input');
    
    if (savedAgentId) {
        agentIdInput.value = savedAgentId;
        window.demoConfig.agentId = savedAgentId;
    } else if (window.demoConfig.agentId) {
        agentIdInput.value = window.demoConfig.agentId;
    }
}

/**
 * Update agent ID
 */
function updateAgentId() {
    const agentIdInput = document.getElementById('agent-id-input');
    const newAgentId = agentIdInput.value.trim();
    
    if (!newAgentId) {
        alert('Please enter a valid Agent ID');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('glean_agent_id', newAgentId);
    window.demoConfig.agentId = newAgentId;
    
    // Reinitialize chat
    gleanChatInitialized = false;
    initializeGleanChat();
    
    console.log('Agent ID updated:', newAgentId);
}

/**
 * Start new claim flow
 */
function startNewClaim() {
    currentIntent = 'new-claim';
    showChat('I want to file a new insurance claim. What information do you need from me?');
}

/**
 * Check existing claim flow
 */
function checkExistingClaim() {
    currentIntent = 'check-claim';
    showChat('I want to check on an existing claim. What information do you need?');
}

/**
 * Return to landing page
 */
function returnToLanding() {
    // Hide chat and back button
    document.getElementById('chat-container').classList.remove('active');
    document.getElementById('back-button').classList.remove('visible');
    
    // Show landing page
    document.getElementById('landing-page').classList.remove('hidden');
    
    // Reset state
    currentIntent = null;
    gleanChatInitialized = false;
    
    // Clear chat container
    const container = document.getElementById('glean-agent');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Show chat with initial message
 */
function showChat(initialMessage) {
    // Hide landing page
    document.getElementById('landing-page').classList.add('hidden');
    
    // Show back button and chat
    document.getElementById('back-button').classList.add('visible');
    document.getElementById('chat-container').classList.add('active');
    
    // Initialize chat with message
    initializeGleanChat(initialMessage);
}

/**
 * Initialize Glean chat with optional initial message
 */
function initializeGleanChat(initialMessage = null) {
    if (gleanChatInitialized) {
        console.log('Glean chat already initialized');
        return;
    }
    
    if (!window.EmbeddedSearch) {
        console.error('Glean WebSDK not loaded');
        setTimeout(() => initializeGleanChat(initialMessage), 500);
        return;
    }
    
    const agentId = window.demoConfig.agentId;
    if (!agentId || agentId === 'legal-claims-assistant') {
        console.warn('Using default agent ID. Please update with your actual Glean Agent ID.');
    }
    
    const container = document.getElementById('glean-agent');
    if (!container) {
        console.error('Chat container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    try {
        // Get auth token
        const authToken = window.getGleanAuthToken ? window.getGleanAuthToken() : null;
        
        // Use provided initial message or default
        const message = initialMessage || `Hi! I'm your AI claims assistant. How can I help you today?`;
        
        // Render Glean chat
        window.EmbeddedSearch.renderChat(container, {
            applicationId: agentId,
            authToken: authToken,
            initialMessage: message,
            theme: {
                primaryColor: '#2563eb',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            placeholder: 'Type your response here...',
            showWelcomeMessage: false,
            enableFeedback: true,
            enableCopy: true,
            customizations: {
                features: {
                    chatMenu: false,
                    chatSettings: false,
                    createPrompt: false,
                    clearChat: false
                }
            }
        });
        
        gleanChatInitialized = true;
        console.log('Glean chat initialized successfully with intent:', currentIntent);
        
    } catch (error) {
        console.error('Error initializing Glean chat:', error);
    }
}

/**
 * Toggle help modal
 */
function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.toggle('active');
        
        // Prevent body scroll when modal is open
        if (modal.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

/**
 * Close help modal when clicking on backdrop
 */
function closeHelpModalOnBackdrop(event) {
    if (event.target.id === 'help-modal') {
        toggleHelpModal();
    }
}

/**
 * Close modal on Escape key
 */
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('help-modal');
        if (modal && modal.classList.contains('active')) {
            toggleHelpModal();
        }
    }
});

/**
 * Check claim status
 */
function checkStatus() {
    const claimId = prompt('Enter your Claim ID (e.g., CL-2025-0001):');
    
    if (!claimId) {
        return;
    }
    
    // Call API to get claim status
    if (window.apiClient && window.apiClient.getClaimDetails) {
        window.apiClient.getClaimDetails(claimId)
            .then(response => {
                if (response.success) {
                    const claim = response.claim;
                    const statusMessage = `
Claim Status: ${claim.status.toUpperCase()}

Claim ID: ${claim.claimId}
Submitted: ${new Date(claim.submittedDate).toLocaleDateString()}
Assigned To: ${claim.assignedTo || 'Pending'}
AI Recommendation: ${claim.aiRecommendation || 'Pending'}

Current Status: ${getStatusDescription(claim.status)}
                    `.trim();
                    
                    alert(statusMessage);
                } else {
                    alert('Claim not found. Please check your Claim ID and try again.');
                }
            })
            .catch(error => {
                console.error('Error fetching claim status:', error);
                alert('Unable to fetch claim status. Please try again later.');
            });
    } else {
        // Fallback if API client not available
        alert('Status check functionality requires backend connection. Please ensure the API is deployed.');
    }
}

/**
 * Get human-readable status description
 */
function getStatusDescription(status) {
    const descriptions = {
        'submitted': 'Your claim has been submitted and is awaiting assignment.',
        'assigned': 'Your claim has been assigned to a reviewer.',
        'under_review': 'Your claim is currently being reviewed.',
        'approved': 'Your claim has been approved! Payment will be processed soon.',
        'denied': 'Your claim has been denied. You will receive a detailed explanation.',
        'more_info_needed': 'Additional information is required. Please check your email.'
    };
    
    return descriptions[status] || 'Status unknown';
}

// Make functions available globally
window.updateAgentId = updateAgentId;
window.toggleHelpModal = toggleHelpModal;
window.closeHelpModalOnBackdrop = closeHelpModalOnBackdrop;
window.checkStatus = checkStatus;
window.startNewClaim = startNewClaim;
window.checkExistingClaim = checkExistingClaim;
window.returnToLanding = returnToLanding;
