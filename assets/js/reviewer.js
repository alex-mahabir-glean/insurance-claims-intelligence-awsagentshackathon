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
    if (!agentId || agentId === 'legal-claims-assistant') {
        console.warn('Using default agent ID. Please update with your actual Glean Agent ID.');
    }
    
    const container = document.getElementById('glean-agent-detail');
    if (!container) {
        console.error('Chat container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
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
        container.innerHTML = '';
        
        const agentId = window.demoConfig.agentId;
        
        // Pass the DOM element itself, not the ID string
        window.EmbeddedSearch.renderChat(container, {
            agentId: agentId,
            enable3PCookieAccessRequest: true,
            historyMode: "memory",
            initialMessage: message
        });
    }
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
