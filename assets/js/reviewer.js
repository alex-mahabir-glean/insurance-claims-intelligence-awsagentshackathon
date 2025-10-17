/**
 * Reviewer Portal Logic
 * Handles claim review dashboard and detail view
 * Version: 2.0 - Fixed assessor filtering
 */

// Global state
let currentView = 'landing'; // Start with landing page
let currentClaim = null;
let allClaims = [];
let currentFilter = 'all';
let gleanChatInitialized = false;
let isAdminMode = false;
let selectedRole = null;

/**
 * Check if agent ID is a placeholder value
 */
function isPlaceholderAgentId(agentId) {
    return !agentId || 
           agentId === 'your-glean-agent-id' || 
           agentId.trim() === '' ||
           agentId === 'legal-claims-assistant';
}

// Reviewer data
const reviewers = {
    'sarah-chen': { name: 'Sarah Chen', id: 'sarah-chen' },
    'mike-torres': { name: 'Mike Torres', id: 'mike-torres' },
    'lisa-park': { name: 'Lisa Park', id: 'lisa-park' },
    'alex-rivera': { name: 'Alex Rivera', id: 'alex-rivera' },
    'jordan-kim': { name: 'Jordan Kim', id: 'jordan-kim' },
    'taylor-brooks': { name: 'Taylor Brooks', id: 'taylor-brooks' },
    'reviewer-sarah-johnson': { name: 'Sarah Johnson', id: 'reviewer-sarah-johnson' },
    'reviewer-michael-chen': { name: 'Michael Chen', id: 'reviewer-michael-chen' },
    'reviewer-emily-rodriguez': { name: 'Emily Rodriguez', id: 'reviewer-emily-rodriguez' },
    'reviewer-david-thompson': { name: 'David Thompson', id: 'reviewer-david-thompson' },
    'reviewer-jessica-martinez': { name: 'Jessica Martinez', id: 'reviewer-jessica-martinez' }
};

/**
 * Select role from landing page
 */
function selectRole(role) {
    selectedRole = role;
    
    // Save state to sessionStorage
    sessionStorage.setItem('reviewer_state', JSON.stringify({ role: role }));
    
    // Hide landing page
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('back-to-landing').classList.add('visible');
    document.getElementById('dashboard-view').classList.add('active');
    
    if (role === 'admin') {
        // Admin mode - show all claims
        isAdminMode = true;
        window.demoConfig.reviewerId = 'admin';
        applyReviewerSelection('admin');
        updateCurrentAssessorDisplay('admin');
        document.getElementById('header-actions').classList.add('visible');
        loadClaims();
        currentView = 'dashboard';
    } else {
        // Assessor mode - default to Sarah Chen, show header actions
        isAdminMode = false;
        window.demoConfig.reviewerId = 'sarah-chen';
        applyReviewerSelection('sarah-chen');
        updateCurrentAssessorDisplay('sarah-chen');
        document.getElementById('header-actions').classList.add('visible');
        loadClaims();
        currentView = 'dashboard';
    }
}

/**
 * Open assessor selection modal
 */
function openAssessorModal() {
    // Update stats before showing modal
    updateAssessorStats();
    document.getElementById('assessor-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Update assessor stats in modal with live data
 */
async function updateAssessorStats() {
    let allClaimsData = [];
    
    // Try to get all claims from API first, then fall back to sample data
    try {
        const apiConfigured = window.demoConfig.apiBaseUrl && 
                            window.demoConfig.apiBaseUrl !== 'https://xxx.execute-api.us-east-1.amazonaws.com/prod';
        
        if (window.apiClient && apiConfigured) {
            console.log('Fetching all claims from API for stats...');
            const response = await window.apiClient.getAllClaims({});
            if (response.success && response.claims) {
                allClaimsData = response.claims;
                console.log('Got', allClaimsData.length, 'claims from API for stats');
            }
        } else {
            allClaimsData = window.sampleClaims || [];
            console.log('Using sample data:', allClaimsData.length, 'claims');
        }
    } catch (error) {
        console.error('Error fetching claims for stats:', error);
        allClaimsData = window.sampleClaims || [];
    }
    
    console.log('Updating assessor stats from', allClaimsData.length, 'total claims');
    
    // Calculate stats for each assessor
    const assessorStats = {
        'sarah-chen': { active: 0, total: 247 },
        'mike-torres': { active: 0, total: 189 },
        'lisa-park': { active: 0, total: 312 },
        'alex-rivera': { active: 0, total: 156 },
        'jordan-kim': { active: 0, total: 203 },
        'taylor-brooks': { active: 0, total: 278 }
    };
    
    // Count active claims for each assessor
    allClaimsData.forEach(claim => {
        const assessorId = claim.assignedTo;
        if (assessorStats[assessorId]) {
            if (claim.status === 'assigned' || claim.status === 'under_review') {
                assessorStats[assessorId].active++;
            }
        }
    });
    
    console.log('Calculated stats:', assessorStats);
    
    // Update the DOM for each assessor tile
    Object.keys(assessorStats).forEach(assessorId => {
        const stats = assessorStats[assessorId];
        const tile = document.querySelector(`[onclick="selectAssessor('${assessorId}')"]`);
        
        if (tile) {
            const activeValue = tile.querySelector('.assessor-stat-value');
            const totalValue = tile.querySelectorAll('.assessor-stat-value')[1];
            
            if (activeValue) {
                activeValue.textContent = stats.active;
                console.log(`Updated ${assessorId} active to ${stats.active}`);
            }
            if (totalValue) {
                totalValue.textContent = stats.total;
            }
        }
    });
}

/**
 * Close assessor selection modal
 */
function closeAssessorModal() {
    document.getElementById('assessor-modal').classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Close modal on backdrop click
 */
function closeAssessorModalOnBackdrop(event) {
    if (event.target.id === 'assessor-modal') {
        closeAssessorModal();
    }
}

/**
 * Select specific assessor
 */
function selectAssessor(assessorId) {
    // Close modal
    closeAssessorModal();
    
    // Update assessor
    window.demoConfig.reviewerId = assessorId;
    applyReviewerSelection(assessorId);
    updateCurrentAssessorDisplay(assessorId);
    
    // Reload claims for the selected assessor
    loadClaims();
}

/**
 * Update current assessor display in header
 */
function updateCurrentAssessorDisplay(assessorId) {
    const assessorDisplay = document.getElementById('current-assessor');
    if (assessorId === 'admin') {
        assessorDisplay.innerHTML = `Viewing as: <strong>Admin</strong>`;
    } else {
        const assessorName = reviewers[assessorId]?.name || 'Unknown';
        assessorDisplay.innerHTML = `Viewing as: <strong>${assessorName}</strong>`;
    }
}

/**
 * Return to landing page
 */
function returnToLanding() {
    // Show landing page
    document.getElementById('landing-page').classList.remove('hidden');
    
    // Hide all other views
    document.getElementById('back-to-landing').classList.remove('visible');
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('header-actions').classList.remove('visible');
    
    // Reset state
    selectedRole = null;
    currentView = 'landing';
    isAdminMode = false;
    sessionStorage.removeItem('reviewer_state');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Reviewer portal initializing... Version 2.0');
    console.log('Sample claims loaded:', window.sampleClaims ? window.sampleClaims.length : 0, 'claims');
    
    // Verify claims data
    if (window.sampleClaims && window.sampleClaims.length > 0) {
        const claimsByAssessor = {};
        window.sampleClaims.forEach(claim => {
            if (!claimsByAssessor[claim.assignedTo]) {
                claimsByAssessor[claim.assignedTo] = [];
            }
            claimsByAssessor[claim.assignedTo].push(claim.claimId);
        });
        console.log('Claims by assessor:', claimsByAssessor);
    }
    
    // Load saved agent ID
    loadAgentId();
    
    // Restore previous state if exists
    const savedState = sessionStorage.getItem('reviewer_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        if (state.role) {
            selectRole(state.role);
        }
    }
});

/**
 * Load agent ID from localStorage or config
 */
function loadAgentId() {
    // Agent ID is now hardcoded in config - don't override from localStorage
    // Clear any old localStorage values to prevent conflicts
    localStorage.removeItem('glean_agent_id');
    
    const agentIdInput = document.getElementById('agent-id-input');
    
    // Agent ID input was removed, so check if it exists
    if (agentIdInput && window.demoConfig.agentId) {
        agentIdInput.value = window.demoConfig.agentId;
    }
}

/**
 * Update agent ID
 */
function updateAgentId() {
    const agentIdInput = document.getElementById('agent-id-input');
    
    // Agent ID input was removed, so check if it exists
    if (!agentIdInput) {
        console.log('Agent ID is hardcoded:', window.demoConfig.agentId);
        return;
    }
    
    const newAgentId = agentIdInput.value.trim();
    
    if (!newAgentId) {
        alert('Please enter a valid Agent ID');
        return;
    }
    
    localStorage.setItem('glean_agent_id', newAgentId);
    window.demoConfig.agentId = newAgentId;
    
    // Reinitialize chat if in detail view
    if (currentView === 'detail' && currentClaim) {
        gleanChatInitialized = false;
        initializeGleanChat(currentClaim);
    }
    
    console.log('Agent ID updated:', newAgentId);
}

/**
 * Load saved reviewer selection
 */
function loadReviewerSelection() {
    const savedSelection = localStorage.getItem('selected_reviewer') || 'sarah-chen';
    const selectElement = document.getElementById('reviewer-select');
    
    if (selectElement) {
        selectElement.value = savedSelection;
        applyReviewerSelection(savedSelection);
    }
}

/**
 * Switch reviewer view
 */
function switchReviewer() {
    const selectElement = document.getElementById('reviewer-select');
    const selectedValue = selectElement.value;
    
    // Save selection
    localStorage.setItem('selected_reviewer', selectedValue);
    
    // Apply selection
    applyReviewerSelection(selectedValue);
    
    // Reload claims
    loadClaims();
}

/**
 * Apply reviewer selection to config
 */
function applyReviewerSelection(selection) {
    if (selection === 'admin') {
        isAdminMode = true;
        window.demoConfig.reviewerId = null;
        window.demoConfig.reviewerName = 'Admin';
        console.log('Admin mode enabled - showing all claims');
    } else {
        isAdminMode = false;
        const reviewer = reviewers[selection];
        if (reviewer) {
            window.demoConfig.reviewerId = reviewer.id;
            window.demoConfig.reviewerName = reviewer.name;
            console.log(`Switched to reviewer: ${reviewer.name}`);
        }
    }
}

/**
 * Load claims data from API or fallback to sample data
 */
async function loadClaims() {
    const claimsList = document.getElementById('claims-list');
    
    // Show loading state
    claimsList.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    try {
        // Check if API is configured
        const apiConfigured = window.demoConfig.apiBaseUrl && 
                            window.demoConfig.apiBaseUrl !== 'https://xxx.execute-api.us-east-1.amazonaws.com/prod';
        
        if (window.apiClient && apiConfigured) {
            console.log('Loading claims from API:', window.demoConfig.apiBaseUrl);
            
            // In admin mode, don't filter by reviewer
            const filters = isAdminMode ? {} : { reviewerId: window.demoConfig.reviewerId };
            
            const response = await window.apiClient.getAllClaims(filters);
            
            if (response.success && response.claims) {
                allClaims = response.claims;
                const modeText = isAdminMode ? 'all claims' : `claims for ${window.demoConfig.reviewerName}`;
                console.log(`Loaded ${allClaims.length} ${modeText} from API`);
            } else {
                throw new Error('Invalid API response format');
            }
        } else {
            // Fallback to sample data
            console.log('Using sample data (API not configured)');
            const sampleData = window.sampleClaims || [];
            
            // Filter by reviewer if not in admin mode
            if (isAdminMode) {
                allClaims = sampleData;
                console.log(`Loaded ${allClaims.length} claims (admin mode - all claims)`);
            } else {
                allClaims = sampleData.filter(c => c.assignedTo === window.demoConfig.reviewerId);
                console.log(`Loaded ${allClaims.length} claims for ${window.demoConfig.reviewerName}`);
            }
        }
        
        // Update KPIs
        updateKPIs();
        
        // Render claims list
        renderClaimsList();
        
    } catch (error) {
        console.error('Error loading claims:', error);
        
        // Show error notification
        showNotification('Failed to load claims from API. Using sample data.', 'warning');
        
        // Fallback to sample data
        const sampleData = window.sampleClaims || [];
        
        // Filter by reviewer if not in admin mode
        if (isAdminMode) {
            allClaims = sampleData;
        } else {
            allClaims = sampleData.filter(c => c.assignedTo === window.demoConfig.reviewerId);
        }
        
        updateKPIs();
        renderClaimsList();
    }
}

/**
 * Update KPI cards
 */
function updateKPIs() {
    const activeClaims = allClaims.filter(c => 
        c.status === 'assigned' || c.status === 'under_review'
    );
    
    const todayClaims = allClaims.filter(c => {
        const assignedDate = new Date(c.assignedDate || c.submittedDate);
        const today = new Date();
        return assignedDate.toDateString() === today.toDateString();
    });
    
    if (isAdminMode) {
        // Admin mode - show system-wide stats
        const approvedClaims = allClaims.filter(c => c.status === 'approved');
        const deniedClaims = allClaims.filter(c => c.status === 'denied');
        
        document.getElementById('kpi-active').textContent = activeClaims.length;
        document.getElementById('kpi-today').textContent = todayClaims.length;
        document.getElementById('kpi-total').textContent = allClaims.length;
        document.getElementById('kpi-avg-time').textContent = `${approvedClaims.length}/${deniedClaims.length}`;
        
        // Update KPI labels for admin mode
        document.querySelector('#kpi-active').parentElement.querySelector('p').textContent = 'Active in system';
        document.querySelector('#kpi-today').parentElement.querySelector('p').textContent = 'Submitted today';
        document.querySelector('#kpi-total').parentElement.querySelector('h3').textContent = 'Total Claims';
        document.querySelector('#kpi-total').parentElement.querySelector('p').textContent = 'All time';
        document.querySelector('#kpi-avg-time').parentElement.querySelector('h3').textContent = 'Approved/Denied';
        document.querySelector('#kpi-avg-time').parentElement.querySelector('p').textContent = 'Resolution stats';
    } else {
        // Reviewer mode - show individual stats
        const reviewer = window.sampleReviewers?.find(r => r.reviewerId === window.demoConfig.reviewerId);
        
        document.getElementById('kpi-active').textContent = activeClaims.length;
        document.getElementById('kpi-today').textContent = todayClaims.length;
        document.getElementById('kpi-total').textContent = reviewer?.totalClaimsReviewed || 247;
        document.getElementById('kpi-avg-time').textContent = reviewer?.avgReviewTime ? `${reviewer.avgReviewTime}d` : '2.3d';
        
        // Reset KPI labels for reviewer mode
        document.querySelector('#kpi-active').parentElement.querySelector('p').textContent = 'Currently assigned to you';
        document.querySelector('#kpi-today').parentElement.querySelector('p').textContent = 'New assignments';
        document.querySelector('#kpi-total').parentElement.querySelector('h3').textContent = 'Total Reviewed';
        document.querySelector('#kpi-total').parentElement.querySelector('p').textContent = 'Lifetime claims';
        document.querySelector('#kpi-avg-time').parentElement.querySelector('h3').textContent = 'Avg Time';
        document.querySelector('#kpi-avg-time').parentElement.querySelector('p').textContent = 'Average review time';
    }
}

/**
 * Render claims list
 */
function renderClaimsList() {
    const claimsList = document.getElementById('claims-list');
    
    // Update section header based on mode
    const sectionTitle = document.querySelector('.section-header h2');
    if (sectionTitle) {
        if (isAdminMode) {
            sectionTitle.textContent = 'All Claims (Admin View)';
        } else {
            sectionTitle.textContent = `My Claims (${window.demoConfig.reviewerName})`;
        }
    }
    
    // Filter claims by status
    let filteredClaims = allClaims;
    if (currentFilter === 'pending') {
        filteredClaims = allClaims.filter(c => c.status === 'assigned');
    } else if (currentFilter === 'review') {
        filteredClaims = allClaims.filter(c => c.status === 'under_review');
    } else if (currentFilter === 'completed') {
        filteredClaims = allClaims.filter(c => c.status === 'approved' || c.status === 'denied');
    }
    
    // Note: allClaims is already filtered by assessor in loadClaims()
    
    if (filteredClaims.length === 0) {
        claimsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No claims found</h3>
                <p>There are no claims matching the current filter.</p>
            </div>
        `;
        return;
    }
    
    claimsList.innerHTML = filteredClaims.map(claim => `
        <div class="claim-card" onclick="openClaimDetail('${claim.claimId}')">
            <div class="claim-card-header">
                <div class="claim-id">${claim.claimId}</div>
                <div class="claim-badge badge-${getStatusClass(claim.status)}">
                    <i class="fas ${getStatusIcon(claim.status)}"></i>
                    ${claim.status.replace('_', ' ')}
                </div>
            </div>
            <div class="claim-card-body">
                <div class="claim-info-item">
                    <div class="claim-info-label">Claimant</div>
                    <div class="claim-info-value">${claim.claimantInfo.name}</div>
                </div>
                <div class="claim-info-item">
                    <div class="claim-info-label">Type</div>
                    <div class="claim-info-value">${capitalizeFirst(claim.claimType)}</div>
                </div>
                <div class="claim-info-item">
                    <div class="claim-info-label">Value</div>
                    <div class="claim-info-value">$${claim.claimValue.toLocaleString()}</div>
                </div>
                <div class="claim-info-item">
                    <div class="claim-info-label">${isAdminMode ? 'Assigned To' : 'Submitted'}</div>
                    <div class="claim-info-value">${isAdminMode && claim.assignedTo ? getReviewerName(claim.assignedTo) : formatDate(claim.submittedDate)}</div>
                </div>
            </div>
            ${claim.aiRecommendation ? `
                <div class="ai-recommendation-bar">
                    <div class="ai-recommendation ${claim.aiRecommendation === 'approve' ? 'recommend-approve' : 'recommend-deny'}" ${claim.aiRecommendationReason ? 'onclick="event.stopPropagation(); toggleAIRecommendation(event)"' : ''}>
                        <i class="fas fa-lightbulb"></i>
                        <div class="ai-recommendation-content">
                            <span class="ai-recommendation-text">
                                AI Insight: ${claim.aiRecommendation === 'approve' ? 'Approval' : 'Denial'} recommended (${Math.round(claim.aiConfidence * 100)}% confidence)
                            </span>
                            ${claim.aiRecommendationReason ? `
                                <span class="ai-recommendation-reason">${claim.aiRecommendationReason}</span>
                            ` : ''}
                        </div>
                        ${claim.aiRecommendationReason ? '<i class="fas fa-chevron-down expand-icon"></i>' : ''}
                    </div>
                    <div class="claim-card-actions">
                        <button class="claim-card-action-btn approve" onclick="event.stopPropagation(); handleApprove('${claim.claimId}')">
                            <i class="fas fa-check-circle"></i>
                            Approve
                        </button>
                        <button class="claim-card-action-btn deny" onclick="event.stopPropagation(); handleDeny('${claim.claimId}')">
                            <i class="fas fa-times-circle"></i>
                            Deny
                        </button>
                        <button class="claim-card-action-btn assess" onclick="event.stopPropagation(); handleAIAssessment('${claim.claimId}')">
                            <i class="fas fa-chart-line"></i>
                            AI Assessment
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Filter claims
 */
function filterClaims(filter) {
    currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderClaimsList();
}

/**
 * Open claim detail view
 */
function openClaimDetail(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) {
        console.error('Claim not found:', claimId);
        return;
    }
    
    currentClaim = claim;
    currentView = 'detail';
    
    // Hide dashboard, show detail
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('active');
    
    // Update detail title
    document.getElementById('detail-claim-id').textContent = `${claim.claimId} - ${capitalizeFirst(claim.claimType)} Claim`;
    
    // Render claim info panel
    renderClaimInfoPanel(claim);
    
    // Initialize Glean chat with auto-review
    setTimeout(() => initializeGleanChat(claim), 500);
}

/**
 * Render claim info panel
 */
function renderClaimInfoPanel(claim) {
    const panel = document.getElementById('claim-info-panel');
    
    panel.innerHTML = `
        <div class="claim-info-section">
            <h3>Claimant Information</h3>
            <div class="info-row">
                <div class="info-row-label">Name</div>
                <div class="info-row-value">${claim.claimantInfo.name}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Email</div>
                <div class="info-row-value">${claim.claimantInfo.email}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Phone</div>
                <div class="info-row-value">${claim.claimantInfo.phone}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Address</div>
                <div class="info-row-value">${claim.claimantInfo.address}</div>
            </div>
        </div>
        
        <div class="claim-info-section">
            <h3>Claim Details</h3>
            <div class="info-row">
                <div class="info-row-label">Policy Number</div>
                <div class="info-row-value">${claim.policyNumber}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Claim Type</div>
                <div class="info-row-value">${capitalizeFirst(claim.claimType)}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Incident Date</div>
                <div class="info-row-value">${formatDate(claim.incidentDate)}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Claim Value</div>
                <div class="info-row-value">$${claim.claimValue.toLocaleString()}</div>
            </div>
            <div class="info-row">
                <div class="info-row-label">Status</div>
                <div class="info-row-value">${claim.status.replace('_', ' ').toUpperCase()}</div>
            </div>
        </div>
        
        <div class="claim-info-section">
            <h3>Incident Description</h3>
            <div class="info-row">
                <div class="info-row-value">${claim.incidentDescription}</div>
            </div>
            ${claim.injuries ? `
                <div class="info-row">
                    <div class="info-row-label">Injuries</div>
                    <div class="info-row-value">${claim.injuryDescription || 'Yes'}</div>
                </div>
            ` : ''}
            ${claim.policeReport ? `
                <div class="info-row">
                    <div class="info-row-label">Police Report</div>
                    <div class="info-row-value">${claim.policeReport}</div>
                </div>
            ` : ''}
        </div>
        
        ${claim.documents && claim.documents.length > 0 ? `
            <div class="claim-info-section">
                <h3>Documents</h3>
                <div class="document-list">
                    ${claim.documents.map(doc => `
                        <div class="document-item">
                            <i class="fas fa-file-alt"></i>
                            <span>${capitalizeFirst(doc.type.replace('_', ' '))}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="claim-info-section">
            <h3>Timeline</h3>
            <div class="info-row">
                <div class="info-row-label">Submitted</div>
                <div class="info-row-value">${formatDateTime(claim.submittedDate)}</div>
            </div>
            ${claim.assignedDate ? `
                <div class="info-row">
                    <div class="info-row-label">Assigned</div>
                    <div class="info-row-value">${formatDateTime(claim.assignedDate)}</div>
                </div>
            ` : ''}
            ${claim.reviewedDate ? `
                <div class="info-row">
                    <div class="info-row-label">Reviewed</div>
                    <div class="info-row-value">${formatDateTime(claim.reviewedDate)}</div>
                </div>
            ` : ''}
        </div>
        
        ${claim.aiRecommendation ? `
            <div class="claim-info-section">
                <h3>AI Insight</h3>
                <div class="ai-recommendation-detail ${claim.aiRecommendation === 'approve' ? 'recommend-approve' : 'recommend-deny'}" ${claim.aiRecommendationReason ? 'onclick="toggleAIRecommendation(event)"' : ''}>
                    <i class="fas fa-lightbulb"></i>
                    <div class="ai-recommendation-content">
                        <span class="ai-recommendation-text">
                            ${claim.aiRecommendation === 'approve' ? 'Approval' : 'Denial'} recommended (${Math.round(claim.aiConfidence * 100)}% confidence)
                        </span>
                        ${claim.aiRecommendationReason ? `
                            <span class="ai-recommendation-reason">${claim.aiRecommendationReason}</span>
                        ` : ''}
                    </div>
                    ${claim.aiRecommendationReason ? '<i class="fas fa-chevron-down expand-icon"></i>' : ''}
                </div>
            </div>
        ` : ''}
    `;
}

/**
 * Initialize Glean chat with auto-review
 */
function initializeGleanChat(claim) {
    if (gleanChatInitialized) {
        console.log('Glean chat already initialized');
        return;
    }
    
    if (!window.EmbeddedSearch) {
        console.error('Glean WebSDK not loaded');
        setTimeout(() => initializeGleanChat(claim), 500);
        return;
    }
    
    const agentId = window.demoConfig.agentId;
    const container = document.getElementById('glean-agent-detail');
    if (!container) {
        console.error('Chat container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if agent ID is a placeholder
    if (isPlaceholderAgentId(agentId)) {
        container.innerHTML = `
            <div id="agentcore-fallback-container-detail" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; background: #f8f9fa;">
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
                    <button onclick="showAgentCoreChatDetail()" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; font-size: 1rem;">
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
        
        // Build initial message with AI analysis
        const initialMessage = buildReviewMessage(claim);
        
        // Render Glean chat
        window.EmbeddedSearch.renderChat(container, {
            applicationId: agentId,
            authToken: authToken,
            initialMessage: initialMessage,
            theme: {
                primaryColor: '#2563eb',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            placeholder: 'Ask me anything about this claim...',
            showWelcomeMessage: false,
            enableFeedback: true,
            enableCopy: true
        });
        
        gleanChatInitialized = true;
        console.log('Glean chat initialized with auto-review');
        
    } catch (error) {
        console.error('Error initializing Glean chat:', error);
    }
}

/**
 * Build review message for Glean chat
 */
function buildReviewMessage(claim) {
    const recommendation = claim.aiRecommendation ? claim.aiRecommendation.toUpperCase() : 'PENDING';
    const confidence = claim.aiConfidence ? Math.round(claim.aiConfidence * 100) : 0;
    
    return `I've analyzed claim ${claim.claimId}. Here's my assessment:

**RECOMMENDATION: ${recommendation}**
Confidence: ${confidence}%

**Key Findings:**
${claim.aiRecommendationReason || 'Analysis in progress...'}

**Policy Coverage:**
Policy ${claim.policyNumber} is active and includes coverage for ${claim.claimType} claims.

**What would you like to do?**

You can:
- Approve this claim
- Deny this claim
- Request more information from the claimant
- Reassign to another reviewer
- Ask me questions about the policy or similar cases`;
}

/**
 * Back to dashboard
 */
function backToDashboard() {
    currentView = 'dashboard';
    currentClaim = null;
    
    document.getElementById('detail-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.remove('hidden');
}

/**
 * Close modal when clicking on backdrop
 */
function closeModalOnBackdrop(event) {
    if (event.target.id === 'detail-view') {
        backToDashboard();
    }
}

/**
 * Logout
 */
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'submitter.html';
    }
}

/**
 * Helper functions
 */
function getStatusClass(status) {
    const statusMap = {
        'submitted': 'submitted',
        'assigned': 'assigned',
        'under_review': 'under_review',
        'approved': 'approved',
        'denied': 'denied',
        'more_info_needed': 'review'
    };
    return statusMap[status] || 'pending';
}

function getStatusIcon(status) {
    const iconMap = {
        'submitted': 'fa-clock',
        'assigned': 'fa-user-check',
        'under_review': 'fa-search',
        'approved': 'fa-check-circle',
        'denied': 'fa-times-circle',
        'more_info_needed': 'fa-info-circle'
    };
    return iconMap[status] || 'fa-clock';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getReviewerName(reviewerId) {
    const reviewer = reviewers[reviewerId];
    return reviewer ? reviewer.name : reviewerId;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 400px;
            font-size: 0.875rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
    }
    
    // Set notification style based on type
    const styles = {
        info: { bg: '#dbeafe', color: '#1e40af', icon: 'fa-info-circle' },
        success: { bg: '#d1fae5', color: '#065f46', icon: 'fa-check-circle' },
        warning: { bg: '#fef3c7', color: '#92400e', icon: 'fa-exclamation-triangle' },
        error: { bg: '#fee2e2', color: '#991b1b', icon: 'fa-times-circle' }
    };
    
    const style = styles[type] || styles.info;
    notification.style.backgroundColor = style.bg;
    notification.style.color = style.color;
    notification.innerHTML = `
        <i class="fas ${style.icon}"></i>
        <span>${message}</span>
    `;
    notification.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 5000);
}

// Add CSS animation
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Chat Overlay Functions
 */
let chatInitialized = false;
let chatExpanded = false;
let pendingInitialMessage = null; // Store initial message for AgentCore fallback
let userChoseAgentCore = false; // Track if user has chosen to use AgentCore

function showChatOverlay(initialMessage = null) {
    const chatOverlay = document.getElementById('chat-overlay');
    if (!chatOverlay) return;
    
    // Toggle the overlay if it's already showing and no initial message
    if (chatOverlay.classList.contains('show') && !initialMessage) {
        chatOverlay.classList.remove('show');
        return;
    }
    
    // Show the overlay
    if (!chatOverlay.classList.contains('show')) {
        chatOverlay.classList.add('show');
    }
    
    // Initialize chat if not already done
    if (!chatInitialized) {
        setTimeout(() => {
            renderGleanChatOverlay(initialMessage);
            chatInitialized = true;
        }, 100);
    } else if (initialMessage) {
        // Reload chat with initial message
        reloadGleanChatWithInitialMessage(initialMessage);
    }
}

function renderGleanChatOverlay(initialMessage = null) {
    if (!window.EmbeddedSearch) {
        console.error('Glean WebSDK not loaded');
        setTimeout(() => renderGleanChatOverlay(initialMessage), 500);
        return;
    }
    
    const container = document.getElementById('glean-agent-overlay');
    if (!container) {
        console.error('Chat overlay container not found');
        setTimeout(() => renderGleanChatOverlay(initialMessage), 100);
        return;
    }
    
    const agentId = window.demoConfig.agentId;
    
    // Check if agent ID is a placeholder
    if (isPlaceholderAgentId(agentId)) {
        // If user has already chosen AgentCore, skip fallback and go directly to chat
        if (userChoseAgentCore) {
            // Check if chat UI already exists
            const existingChat = document.getElementById('agentcore-messages-overlay');
            
            if (!existingChat) {
                // Chat doesn't exist yet, create it
                showAgentCoreChatOverlay();
            }
            
            // Send the initial message if provided
            if (initialMessage) {
                setTimeout(() => {
                    const input = document.getElementById('agentcore-input-overlay');
                    if (input) {
                        input.value = initialMessage;
                        sendAgentCoreMessageOverlay();
                    }
                }, 150);
            }
            return;
        }
        
        // Store the initial message for AgentCore fallback
        pendingInitialMessage = initialMessage;
        
        container.innerHTML = `
            <div id="agentcore-fallback-container-overlay" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; background: #f8f9fa;">
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
                    <button onclick="showAgentCoreChatOverlay()" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; font-size: 1rem;">
                        Use AgentCore Direct Chat
                    </button>
                </div>
            </div>
        `;
        console.warn('Placeholder agent ID detected. Showing AgentCore fallback option.');
        return;
    }
    
    const config = {
        agentId: agentId,
        enable3PCookieAccessRequest: true,
        historyMode: "memory"
    };
    
    if (initialMessage) {
        config.initialMessage = initialMessage;
    }
    
    try {
        // Pass the DOM element itself, not the ID string
        window.EmbeddedSearch.renderChat(container, config);
        console.log('Glean chat overlay initialized with config:', config);
    } catch (error) {
        console.error('Error rendering Glean chat:', error);
    }
}

function reloadGleanChatWithInitialMessage(message) {
    const container = document.getElementById('glean-agent-overlay');
    if (container) {
        const agentId = window.demoConfig.agentId;
        
        // Check if placeholder - handle AgentCore flow
        if (isPlaceholderAgentId(agentId)) {
            // If user has already chosen AgentCore, refresh the chat with new message
            if (userChoseAgentCore) {
                // Clear and recreate the chat UI for a fresh conversation
                showAgentCoreChatOverlay();
                // Send the new message
                if (message) {
                    setTimeout(() => {
                        const input = document.getElementById('agentcore-input-overlay');
                        if (input) {
                            input.value = message;
                            sendAgentCoreMessageOverlay();
                        }
                    }, 100);
                }
            } else {
                // First time, clear and show fallback
                container.innerHTML = '';
                renderGleanChatOverlay(message);
            }
            return;
        }
        
        // For real Glean, clear and reload
        container.innerHTML = '';
        
        // Pass the DOM element itself, not the ID string
        window.EmbeddedSearch.renderChat(container, {
            agentId: agentId,
            enable3PCookieAccessRequest: true,
            historyMode: "memory",
            initialMessage: message
        });
    }
}

/**
 * Show AgentCore direct chat in detail view
 */
function showAgentCoreChatDetail() {
    const container = document.getElementById('glean-agent-detail');
    if (!container) return;
    
    const claim = currentClaim;
    const initialMsg = claim ? `Analyzing claim ${claim.claimId}: ${claim.description}` : 'How can I help you review this claim?';
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background: white;">
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 0.5rem;">
                <h3 style="margin: 0; font-family: Inter, sans-serif; color: #1f2937; flex: 1;">AgentCore Direct Chat</h3>
                <button onclick="backToFallbackMessageDetail()" style="padding: 0.5rem 1rem; background: #f3f4f6; border: none; border-radius: 0.375rem; cursor: pointer; font-family: Inter, sans-serif; font-weight: 500;">
                    ← Back
                </button>
            </div>
            <div style="background: #fef3c7; border-bottom: 1px solid #fbbf24; padding: 0.75rem 1rem;">
                <p style="margin: 0; font-family: Inter, sans-serif; font-size: 0.875rem; color: #92400e; line-height: 1.5;">
                    ⚠️ <strong>Limited Experience:</strong> This direct chat bypasses Glean's conversational agents and knowledge graph. This direct chat although somewhat functional was not meant to be customer-facing. Expect an incomplete, and buggy experience with incorrect responses. For the full customer-facing demo experience, configure Glean access and refresh your page or click the 'Back' button above.
                </p>
            </div>
            <div id="agentcore-messages-detail" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;">
                    <strong>AI Assistant:</strong> ${escapeHtmlReviewer(initialMsg)}
                </div>
            </div>
            <div style="padding: 1rem; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="agentcore-input-detail" placeholder="Type your message..." 
                        style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: Inter, sans-serif;"
                        onkeypress="if(event.key === 'Enter') sendAgentCoreMessageDetail()">
                    <button onclick="sendAgentCoreMessageDetail()" 
                        style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-family: Inter, sans-serif;">
                        Send
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show AgentCore direct chat in overlay
 */
function showAgentCoreChatOverlay() {
    // Mark that user has chosen AgentCore
    userChoseAgentCore = true;
    
    const container = document.getElementById('glean-agent-overlay');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background: white;">
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 0.5rem;">
                <h3 style="margin: 0; font-family: Inter, sans-serif; color: #1f2937; flex: 1;">AgentCore Direct Chat</h3>
                <button onclick="backToFallbackMessageOverlay()" style="padding: 0.5rem 1rem; background: #f3f4f6; border: none; border-radius: 0.375rem; cursor: pointer; font-family: Inter, sans-serif; font-weight: 500;">
                    ← Back
                </button>
            </div>
            <div style="background: #fef3c7; border-bottom: 1px solid #fbbf24; padding: 0.75rem 1rem;">
                <p style="margin: 0; font-family: Inter, sans-serif; font-size: 0.875rem; color: #92400e; line-height: 1.5;">
                    ⚠️ <strong>Limited Experience:</strong> This direct chat bypasses Glean's conversational agents and knowledge graph. This direct chat although somewhat functional was not meant to be customer-facing. Expect an incomplete, and buggy experience with incorrect responses. For the full customer-facing demo experience, configure Glean access and refresh your page or click the 'Back' button above.
                </p>
            </div>
            <div id="agentcore-messages-overlay" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;">
                    <strong>AI Assistant:</strong> Hi! I'm your AI review assistant powered by Amazon Bedrock AgentCore. How can I help you today?
                </div>
            </div>
            <div style="padding: 1rem; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="agentcore-input-overlay" placeholder="Type your message..." 
                        style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: Inter, sans-serif;"
                        onkeypress="if(event.key === 'Enter') sendAgentCoreMessageOverlay()">
                    <button onclick="sendAgentCoreMessageOverlay()" 
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
            const input = document.getElementById('agentcore-input-overlay');
            if (input) {
                input.value = messageToSend;
                sendAgentCoreMessageOverlay();
            }
        }, 100);
    }
}

/**
 * Back to fallback message - detail view
 */
function backToFallbackMessageDetail() {
    gleanChatInitialized = false;
    if (currentClaim) {
        showChatDetail(currentClaim);
    }
}

/**
 * Back to fallback message - overlay
 */
function backToFallbackMessageOverlay() {
    // Reset AgentCore choice when going back
    userChoseAgentCore = false;
    renderGleanChatOverlay();
}

/**
 * Send message to AgentCore - detail view
 */
async function sendAgentCoreMessageDetail() {
    const input = document.getElementById('agentcore-input-detail');
    const messagesContainer = document.getElementById('agentcore-messages-detail');
    
    if (!input || !messagesContainer) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'background: #2563eb; color: white; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; align-self: flex-end; max-width: 80%;';
    userMsg.innerHTML = `<strong>You:</strong> ${escapeHtmlReviewer(message)}`;
    messagesContainer.appendChild(userMsg);
    
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show loading
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-msg-detail';
    loadingMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;';
    loadingMsg.innerHTML = '<strong>AI Assistant:</strong> <em>Thinking...</em>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const response = await fetch(`${window.demoConfig.apiBaseUrl}/invoke-review-agent`, {
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
        loadingMsg.remove();
        
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
 * Send message to AgentCore - overlay
 */
async function sendAgentCoreMessageOverlay() {
    const input = document.getElementById('agentcore-input-overlay');
    const messagesContainer = document.getElementById('agentcore-messages-overlay');
    
    if (!input || !messagesContainer) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'background: #2563eb; color: white; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; align-self: flex-end; max-width: 80%;';
    userMsg.innerHTML = `<strong>You:</strong> ${escapeHtmlReviewer(message)}`;
    messagesContainer.appendChild(userMsg);
    
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show loading
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-msg-overlay';
    loadingMsg.style.cssText = 'background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; font-family: Inter, sans-serif; color: #4b5563;';
    loadingMsg.innerHTML = '<strong>AI Assistant:</strong> <em>Thinking...</em>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const response = await fetch(`${window.demoConfig.apiBaseUrl}/invoke-review-agent`, {
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
        loadingMsg.remove();
        
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
function escapeHtmlReviewer(text) {
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

function initChatOverlay() {
    const chatOverlay = document.getElementById('chat-overlay');
    const chatMinimize = document.getElementById('chat-minimize');
    const chatExpand = document.getElementById('chat-expand');
    const chatRefresh = document.getElementById('chat-refresh');
    const resizeHandle = document.getElementById('resize-handle');
    
    // Minimize button
    if (chatMinimize) {
        chatMinimize.addEventListener('click', () => {
            chatOverlay.classList.remove('show');
        });
    }
    
    // Expand/collapse button
    if (chatExpand) {
        chatExpand.addEventListener('click', () => {
            chatExpanded = !chatExpanded;
            if (chatExpanded) {
                chatOverlay.classList.add('expanded');
                chatExpand.innerHTML = '<i class="fas fa-compress"></i>';
                chatExpand.title = 'Collapse';
            } else {
                chatOverlay.classList.remove('expanded');
                chatExpand.innerHTML = '<i class="fas fa-expand"></i>';
                chatExpand.title = 'Expand';
            }
        });
    }
    
    // Refresh button
    if (chatRefresh) {
        chatRefresh.addEventListener('click', () => {
            // Reset AgentCore choice on refresh
            userChoseAgentCore = false;
            chatInitialized = false;
            const container = document.getElementById('glean-agent-overlay');
            if (container) {
                container.innerHTML = '';
                renderGleanChatOverlay();
            }
        });
    }
    
    // Resize functionality
    if (resizeHandle && chatOverlay) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = chatOverlay.offsetWidth;
            startHeight = chatOverlay.offsetHeight;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing || chatExpanded) return;
            
            const deltaX = startX - e.clientX;
            const deltaY = startY - e.clientY;
            
            const newWidth = Math.max(400, Math.min(startWidth + deltaX, window.innerWidth - 40));
            const newHeight = Math.max(400, Math.min(startHeight + deltaY, window.innerHeight - 120));
            
            chatOverlay.style.width = newWidth + 'px';
            chatOverlay.style.height = newHeight + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }
}

// Initialize chat overlay on page load
setTimeout(initChatOverlay, 100);

/**
 * Toggle AI recommendation expansion
 */
function toggleAIRecommendation(event) {
    event.stopPropagation();
    const element = event.currentTarget;
    element.classList.toggle('expanded');
}

/**
 * Action button handlers
 */
function handleApprove(claimId) {
    console.log('Approve claim:', claimId);
    
    // Find the claim to get AI insight
    const claim = allClaims.find(c => c.claimId === claimId);
    let message = `Approve claim ${claimId}`;
    
    if (claim && claim.aiRecommendation) {
        const confidence = Math.round(claim.aiConfidence * 100);
        if (claim.aiRecommendation === 'approve') {
            message = `Approve claim ${claimId}. My assessment aligns with the AI Insight outcome of "Approval recommended" with a ${confidence}% confidence.`;
        } else {
            message = `Approve claim ${claimId} even though the AI Insight recommends denying.`;
        }
    }
    
    showChatOverlay(message);
}

function handleDeny(claimId) {
    console.log('Deny claim:', claimId);
    
    // Find the claim to get AI insight
    const claim = allClaims.find(c => c.claimId === claimId);
    let message = `Deny claim ${claimId}`;
    
    if (claim && claim.aiRecommendation) {
        const confidence = Math.round(claim.aiConfidence * 100);
        if (claim.aiRecommendation === 'deny') {
            message = `Deny claim ${claimId}. My assessment aligns with the AI Insight outcome of "Denial recommended" with a ${confidence}% confidence.`;
        } else {
            message = `Deny claim ${claimId} even though the AI Insight recommends approving.`;
        }
    }
    
    showChatOverlay(message);
}

function handleAIAssessment(claimId) {
    console.log('AI Assessment for claim:', claimId);
    showChatOverlay(`Please provide a comprehensive AI assessment for claim ${claimId} and provide a recommendation, as well as reasoning.`);
}

/**
 * Refresh claims data
 */
async function refreshClaims() {
    const refreshBtn = document.querySelector('.refresh-btn');
    
    // Add refreshing state
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        refreshBtn.disabled = true;
    }
    
    try {
        console.log('Refreshing claims data...');
        
        // Reload claims from API
        await loadClaims();
        
        // Show success feedback
        console.log('Claims refreshed successfully');
        
        // Brief delay to show the animation
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            }
        }, 500);
    } catch (error) {
        console.error('Error refreshing claims:', error);
        
        // Remove refreshing state on error
        if (refreshBtn) {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
    }
}

// Make functions globally accessible
window.selectRole = selectRole;
window.returnToLanding = returnToLanding;
window.openAssessorModal = openAssessorModal;
window.closeAssessorModal = closeAssessorModal;
window.selectAssessor = selectAssessor;
window.updateAgentId = updateAgentId;
window.switchReviewer = switchReviewer;
window.filterClaims = filterClaims;
window.openClaimDetail = openClaimDetail;
window.backToDashboard = backToDashboard;
window.closeModalOnBackdrop = closeModalOnBackdrop;
window.logout = logout;
window.showNotification = showNotification;
window.toggleAIRecommendation = toggleAIRecommendation;
window.handleApprove = handleApprove;
window.handleDeny = handleDeny;
window.handleAIAssessment = handleAIAssessment;
window.showChatOverlay = showChatOverlay;
window.refreshClaims = refreshClaims;
