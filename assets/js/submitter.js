/**
 * Submitter Portal Logic
 * Handles claim submission via Glean Agent
 */

// Global state
let gleanChatInitialized = false;
let currentIntent = null;
let pendingInitialMessage = null; // Store initial message for AgentCore fallback
let userChoseAgentCore = false; // Track if user has chosen to use AgentCore

/**
 * Check if agent ID is a placeholder value
 */
function isPlaceholderAgentId(agentId) {
    return !agentId || 
           agentId === 'your-glean-agent-id' || 
           agentId.trim() === '' ||
           agentId === 'legal-claims-assistant';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Submitter portal initializing...');
    
    // Load saved agent ID
    loadAgentId();
    
    // Restore previous state if exists
    const savedState = sessionStorage.getItem('submitter_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        if (state.intent) {
            currentIntent = state.intent;
            // Restore the chat view
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('chat-controls').classList.add('active');
            document.getElementById('chat-container').classList.add('active');
            
            // Reinitialize with the original intent message
            const intentMessages = {
                'new-claim': 'I want to file a new insurance claim. What information do you need from me?',
                'check-claim': 'I want to check on an existing claim. What information do you need?'
            };
            const initialMessage = intentMessages[state.intent];
            if (initialMessage) {
                initializeGleanChat(initialMessage);
            } else {
                initializeGleanChat();
            }
        }
    }
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
    sessionStorage.setItem('submitter_state', JSON.stringify({ intent: 'new-claim' }));
    showChat('I want to file a new insurance claim. What information do you need from me?');
}

/**
 * Check existing claim flow
 */
function checkExistingClaim() {
    currentIntent = 'check-claim';
    sessionStorage.setItem('submitter_state', JSON.stringify({ intent: 'check-claim' }));
    showChat('I want to check on an existing claim. What information do you need?');
}

/**
 * Return to landing page
 */
function returnToLanding() {
    // Hide chat and controls
    document.getElementById('chat-container').classList.remove('active');
    document.getElementById('chat-controls').classList.remove('active');
    
    // Show landing page
    document.getElementById('landing-page').classList.remove('hidden');
    
    // Reset state
    currentIntent = null;
    gleanChatInitialized = false;
    sessionStorage.removeItem('submitter_state');
    
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
    
    // Show controls and chat
    document.getElementById('chat-controls').classList.add('active');
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
    console.log('Checking agent ID:', agentId, 'Type:', typeof agentId);
    const container = document.getElementById('glean-agent');
    if (!container) {
        console.error('Chat container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if agent ID is a placeholder
    console.log('isPlaceholderAgentId result:', isPlaceholderAgentId(agentId));
    if (isPlaceholderAgentId(agentId)) {
        // If user has already chosen AgentCore, skip fallback and go directly to chat
        if (userChoseAgentCore) {
            showAgentCoreChat();
            // Send the initial message if provided
            if (initialMessage) {
                setTimeout(() => {
                    const input = document.getElementById('agentcore-input');
                    if (input) {
                        input.value = initialMessage;
                        sendAgentCoreMessage();
                    }
                }, 100);
            }
            return;
        }
        
        // Store the initial message for AgentCore fallback
        pendingInitialMessage = initialMessage;
        
        container.innerHTML = `
            <div id="agentcore-fallback-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; background: #f8f9fa;">
                <div style="max-width: 600px;">
                    <svg style="width: 64px; height: 64px; margin-bottom: 1rem; color: #6b7280;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3 style="color: #1f2937; margin-bottom: 0.5rem; font-family: Inter, sans-serif;">Glean Agent Not Configured</h3>
                    <p style="color: #6b7280; margin-bottom: 1.5rem; font-family: Inter, sans-serif; line-height: 1.5;">
                        To complete the Glean implementation steps, you require access to a Glean deployment. 
                        If you don't have access, feel free to utilize the AgentCore agents directly below.
                    </p>
                    <p style="color: #9ca3af; margin-bottom: 1.5rem; font-family: Inter, sans-serif; font-size: 0.875rem; line-height: 1.5;">
                        <strong>Note:</strong> Using AgentCore directly will not utilize the Glean conversational agents, 
                        knowledge graph, and other Glean-specific features, but you can still test the core AI functionality.
                    </p>
                    <button onclick="showAgentCoreChat()" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; font-size: 1rem;">
                        Use AgentCore Direct Chat
                    </button>
                </div>
            </div>
        `;
        console.warn('Placeholder agent ID detected. Showing AgentCore fallback option.');
        return;
    }
    
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
 * Show AgentCore direct chat interface
 */
function showAgentCoreChat() {
    // Mark that user has chosen AgentCore
    userChoseAgentCore = true;
    
    const container = document.getElementById('glean-agent');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background: white;">
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 0.5rem;">
                <h3 style="margin: 0; font-family: Inter, sans-serif; color: #1f2937; flex: 1;">AgentCore Direct Chat</h3>
                <button onclick="backToFallbackMessage()" style="padding: 0.5rem 1rem; background: #f3f4f6; border: none; border-radius: 0.375rem; cursor: pointer; font-family: Inter, sans-serif; font-weight: 500;">
                    ← Back
                </button>
            </div>
            <div style="background: #fef3c7; border-bottom: 1px solid #fbbf24; padding: 0.75rem 1rem;">
                <p style="margin: 0; font-family: Inter, sans-serif; font-size: 0.875rem; color: #92400e; line-height: 1.5;">
                    ⚠️ <strong>Limited Experience:</strong> This direct chat bypasses Glean's conversational agents and knowledge graph. This direct chat although somewhat functional was not meant to be customer-facing. Expect an incomplete, and buggy experience with incorrect responses. For the full customer-facing demo experience, configure Glean access and refresh your page or click the 'Back' button above.
                </p>
            </div>
            <div id="agentcore-messages" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;">
                    <strong>AI Assistant:</strong> Hi! I'm your AI claims assistant powered by Amazon Bedrock AgentCore. How can I help you today?
                </div>
            </div>
            <div style="padding: 1rem; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="agentcore-input" placeholder="Type your message..." 
                        style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: Inter, sans-serif;"
                        onkeypress="if(event.key === 'Enter') sendAgentCoreMessage()">
                    <button onclick="sendAgentCoreMessage()" 
                        style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-family: Inter, sans-serif;">
                        Send
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // If there's a pending initial message, auto-send it
    if (pendingInitialMessage) {
        const messageToSend = pendingInitialMessage;
        pendingInitialMessage = null; // Clear it after capturing
        
        // Wait for DOM to be ready, then send the message
        setTimeout(() => {
            const input = document.getElementById('agentcore-input');
            if (input) {
                input.value = messageToSend;
                sendAgentCoreMessage();
            }
        }, 100);
    }
}

/**
 * Back to fallback message
 */
function backToFallbackMessage() {
    // Reset AgentCore choice when going back
    userChoseAgentCore = false;
    gleanChatInitialized = false;
    initializeGleanChat();
}

/**
 * Send message to AgentCore
 */
async function sendAgentCoreMessage() {
    const input = document.getElementById('agentcore-input');
    const messagesContainer = document.getElementById('agentcore-messages');
    
    if (!input || !messagesContainer) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'background: #2563eb; color: white; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; align-self: flex-end; max-width: 80%;';
    userMsg.innerHTML = `<strong>You:</strong> ${escapeHtmlSubmitter(message)}`;
    messagesContainer.appendChild(userMsg);
    
    // Clear input
    input.value = '';
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show loading
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-msg';
    loadingMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;';
    loadingMsg.innerHTML = '<strong>AI Assistant:</strong> <em>Thinking...</em>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Determine which agent to call based on intent
        // Use review agent for checking claims, intake agent for filing new claims
        const endpoint = currentIntent === 'check-claim' 
            ? '/invoke-review-agent' 
            : '/invoke-intake-agent';
        
        const response = await fetch(`${window.demoConfig.apiBaseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.demoConfig.authToken}`
            },
            body: JSON.stringify({
                prompt: message
            })
        });
        
        const data = await response.json();
        
        // Remove loading message
        loadingMsg.remove();
        
        // Add AI response
        const aiMsg = document.createElement('div');
        aiMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #1f2937;';
        const responseText = data.response || data.message || 'I received your message.';
        aiMsg.innerHTML = `<strong>AI Assistant:</strong> ${cleanAgentCoreResponse(responseText)}`;
        messagesContainer.appendChild(aiMsg);
        
    } catch (error) {
        console.error('Error sending message:', error);
        loadingMsg.remove();
        
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'background: #fee2e2; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #991b1b;';
        
        // Check if it's a CORS error
        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            errorMsg.innerHTML = `
                <strong>Connection Error:</strong> Unable to reach the AgentCore API.<br><br>
                <strong>Note:</strong> The backend may need to be updated to support direct browser access. 
                For the best experience, please configure Glean Agents as described in the setup documentation.
            `;
        } else {
            errorMsg.innerHTML = '<strong>Error:</strong> Failed to send message. Please try again.';
        }
        messagesContainer.appendChild(errorMsg);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtmlSubmitter(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function cleanAgentCoreResponse(text) {
    if (!text) return text;
    
    // Remove <thinking> tags and their content
    text = text.replace(/<thinking>.*?<\/thinking>/gs, '');
    
    // Remove escaped quotes
    text = text.replace(/\\"/g, '"');
    text = text.replace(/\\'/g, "'");
    
    // Convert escaped newlines to actual newlines
    text = text.replace(/\\n/g, '\n');
    
    // Remove leading/trailing whitespace first
    text = text.trim();
    
    // Remove wrapping quotes if the entire response is quoted
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1).trim();
    }
    
    // Convert markdown headers (### Header) to HTML
    text = text.replace(/^### (.+)$/gm, '<strong style="font-size: 1.1em; display: block; margin-top: 0.5em; margin-bottom: 0.5em;">$1</strong>');
    text = text.replace(/^## (.+)$/gm, '<strong style="font-size: 1.2em; display: block; margin-top: 0.5em; margin-bottom: 0.5em;">$1</strong>');
    text = text.replace(/^# (.+)$/gm, '<strong style="font-size: 1.3em; display: block; margin-top: 0.5em; margin-bottom: 0.5em;">$1</strong>');
    
    // Convert markdown bold (**text**) to HTML
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown italic (*text*) to HTML
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert markdown lists (- item or * item) to HTML
    text = text.replace(/^[\-\*] (.+)$/gm, '• $1');
    
    // Convert numbered lists (1. item) - keep as is but ensure proper spacing
    text = text.replace(/^(\d+)\. /gm, '$1. ');
    
    // Convert newlines to <br> for HTML display
    text = text.replace(/\n/g, '<br>');
    
    return text;
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
/**
 * Show AgentCore switch prompt (intermediary page)
 */
function showAgentCoreSwitchPrompt() {
    const container = document.getElementById('glean-agent');
    if (!container) return;
    
    // Update switch button
    const switchBtn = document.getElementById('switch-mode-btn');
    if (switchBtn) {
        switchBtn.onclick = switchBackToGleanSubmitter;
        switchBtn.title = 'Back to Glean';
    }
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; background: #f8f9fa;">
            <div style="max-width: 600px;">
                <svg style="width: 64px; height: 64px; margin-bottom: 1rem; color: #f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <h3 style="color: #1f2937; margin-bottom: 0.5rem; font-family: Inter, sans-serif; font-size: 1.5rem; font-weight: 600;">Switch to AgentCore Direct?</h3>
                <p style="color: #6b7280; margin-bottom: 1rem; font-family: Inter, sans-serif; line-height: 1.6;">
                    You're about to switch from the <strong>Glean conversational AI experience</strong> to <strong>AgentCore Direct</strong>.
                </p>
                <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; text-align: left;">
                    <p style="color: #92400e; margin: 0 0 0.5rem 0; font-family: Inter, sans-serif; font-size: 0.875rem; line-height: 1.5;">
                        <strong>⚠️ What you'll be missing:</strong>
                    </p>
                    <ul style="color: #92400e; margin: 0; padding-left: 1.5rem; font-family: Inter, sans-serif; font-size: 0.875rem; line-height: 1.5;">
                        <li>Glean's conversational agents and knowledge graph</li>
                        <li>Enhanced context understanding and memory</li>
                        <li>Optimized response quality and accuracy</li>
                    </ul>
                </div>
                <p style="color: #6b7280; margin-bottom: 1.5rem; font-family: Inter, sans-serif; font-size: 0.875rem; line-height: 1.5;">
                    <strong>Note:</strong> This option is provided for judges who don't have Glean access. 
                    If you have Glean configured, we recommend using the full Glean experience.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="switchBackToGleanSubmitter()" style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: #1f2937; border: 1px solid #d1d5db; border-radius: 0.5rem; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; font-size: 1rem;">
                        ← Back to Glean
                    </button>
                    <button onclick="switchToAgentCoreDirectSubmitter()" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; font-size: 1rem;">
                        Continue to AgentCore
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Switch to AgentCore Direct mode
 */
function switchToAgentCoreDirectSubmitter() {
    const container = document.getElementById('glean-agent');
    if (!container) return;
    
    // Update switch button
    const switchBtn = document.getElementById('switch-mode-btn');
    if (switchBtn) {
        switchBtn.onclick = switchBackToGleanSubmitter;
        switchBtn.title = 'Switch back to Glean';
        switchBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    }
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background: white;">
            <div style="padding: 0.75rem 1rem; background: #fef3c7; border-bottom: 1px solid #fbbf24; display: flex; align-items: center; justify-content: space-between;">
                <p style="margin: 0; font-family: Inter, sans-serif; color: #92400e; font-size: 0.875rem; line-height: 1.5; flex: 1;">
                    ⚠️ <strong>Limited Experience:</strong> Using AgentCore Direct without Glean's conversational layer.
                </p>
                <button onclick="switchBackToGleanSubmitter()" style="padding: 0.5rem 1rem; background: white; border: 1px solid #fbbf24; border-radius: 0.375rem; cursor: pointer; font-family: Inter, sans-serif; font-weight: 500; font-size: 0.875rem; color: #92400e; white-space: nowrap; margin-left: 1rem;">
                    ← Back to Glean
                </button>
            </div>
            <div id="agentcore-messages" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;">
                    <strong>AI Assistant:</strong> Hi! I'm your AI claims assistant powered by Amazon Bedrock AgentCore. How can I help you with your claim today?
                </div>
            </div>
            <div style="padding: 1rem; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="agentcore-input" placeholder="Type your message..." 
                        style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: Inter, sans-serif;"
                        onkeypress="if(event.key === 'Enter') sendAgentCoreMessageSubmitter()">
                    <button onclick="sendAgentCoreMessageSubmitter()" 
                        style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-family: Inter, sans-serif;">
                        Send
                    </button>
                </div>
            </div>
        </div>
    `;
    
    console.log('Switched to AgentCore Direct mode');
}

/**
 * Send message in AgentCore Direct mode
 */
async function sendAgentCoreMessageSubmitter() {
    const input = document.getElementById('agentcore-input');
    const messagesContainer = document.getElementById('agentcore-messages');
    
    if (!input || !messagesContainer) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'background: #2563eb; color: white; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; align-self: flex-end; max-width: 80%;';
    userMsg.innerHTML = `<strong>You:</strong> ${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    messagesContainer.appendChild(userMsg);
    
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show loading
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-msg';
    loadingMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;';
    loadingMsg.innerHTML = '<strong>AI Assistant:</strong> <em>Thinking...</em>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const response = await fetch(`${window.deploymentConfig.apiBaseUrl}/invoke-intake-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.deploymentConfig.authToken}`
            },
            body: JSON.stringify({
                prompt: message
            })
        });
        
        const data = await response.json();
        loadingMsg.remove();
        
        const aiMsg = document.createElement('div');
        aiMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #1f2937;';
        const responseText = data.response || data.message || 'I received your message.';
        aiMsg.innerHTML = `<strong>AI Assistant:</strong> ${responseText}`;
        messagesContainer.appendChild(aiMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
    } catch (error) {
        console.error('Error sending message:', error);
        loadingMsg.remove();
        
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'background: #fee2e2; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #991b1b;';
        errorMsg.innerHTML = '<strong>Error:</strong> Unable to send message. Please try again.';
        messagesContainer.appendChild(errorMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

/**
 * Switch back to Glean chat
 */
function switchBackToGleanSubmitter() {
    const container = document.getElementById('glean-agent');
    if (!container) return;
    
    // Reset switch button
    const switchBtn = document.getElementById('switch-mode-btn');
    if (switchBtn) {
        switchBtn.onclick = showAgentCoreSwitchPrompt;
        switchBtn.title = 'Switch to AgentCore Direct (for judges without Glean access)';
        switchBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    }
    
    // Get the original intent message
    const intentMessages = {
        'new-claim': 'I want to file a new insurance claim. What information do you need from me?',
        'check-claim': 'I want to check on an existing claim. What information do you need?'
    };
    const initialMessage = currentIntent ? intentMessages[currentIntent] : null;
    
    // Clear container and reinitialize Glean with the original message
    container.innerHTML = '';
    gleanChatInitialized = false;
    initializeGleanChat(initialMessage);
}

window.updateAgentId = updateAgentId;
window.toggleHelpModal = toggleHelpModal;
window.closeHelpModalOnBackdrop = closeHelpModalOnBackdrop;
window.checkStatus = checkStatus;
window.startNewClaim = startNewClaim;
window.checkExistingClaim = checkExistingClaim;
window.returnToLanding = returnToLanding;
window.showAgentCoreSwitchPrompt = showAgentCoreSwitchPrompt;
window.switchToAgentCoreDirectSubmitter = switchToAgentCoreDirectSubmitter;
window.switchBackToGleanSubmitter = switchBackToGleanSubmitter;
window.sendAgentCoreMessageSubmitter = sendAgentCoreMessageSubmitter;
