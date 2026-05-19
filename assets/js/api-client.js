/**
 * API Client for Legal Service Management System
 * Handles all communication with AWS API Gateway
 */

const apiClient = {
    baseUrl: window.demoConfig?.apiBaseUrl || 'https://xxx.execute-api.us-east-1.amazonaws.com/prod',

    /**
     * Make API request with proper error handling and logging
     */
    async request(endpoint, method = 'GET', body = null) {
        const url = `${this.baseUrl}${endpoint}`;

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        if (window.demoConfig?.debug) {
            console.log(`API Request: ${method} ${url}`, body || '');
        }

        try {
            const response = await fetch(url, options);

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Non-JSON response: ${text}`);
            }

            if (window.demoConfig?.debug) {
                console.log(`API Response: ${response.status}`, data);
            }

            if (!response.ok) {
                throw new Error(data.error || data.message || `API request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request error:', {
                endpoint,
                method,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    },

    /**
     * Submit a new claim
     */
    async submitClaim(claimData) {
        return this.request('/submit-claim', 'POST', claimData);
    },

    /**
     * Get claim details by ID
     * Returns detailed information about a specific claim
     */
    async getClaimDetails(claimId) {
        try {
            const response = await this.request(`/claims/${claimId}`, 'GET');

            if (response.success && response.claim) {
                return response;
            }

            return response;
        } catch (error) {
            console.error(`Error fetching claim ${claimId}:`, error);
            throw error;
        }
    },

    /**
     * Get all claims (for reviewer portal)
     * Returns all claims from DynamoDB
     */
    async getAllClaims(filters = {}) {
        try {
            const response = await this.request('/claims', 'GET');

            // Handle both success response formats
            if (response.success && response.claims) {
                let claims = response.claims;

                // Apply client-side filtering if needed
                if (filters.reviewerId) {
                    claims = claims.filter(c => c.assignedTo === filters.reviewerId);
                }
                if (filters.status) {
                    claims = claims.filter(c => c.status === filters.status);
                }

                return {
                    success: true,
                    claims: claims,
                    count: claims.length
                };
            }

            return response;
        } catch (error) {
            console.error('Error fetching claims:', error);
            throw error;
        }
    },

    /**
     * Approve a claim
     */
    async approveClaim(claimId, reviewerId, notes = '') {
        return this.request('/approve-claim', 'POST', {
            claimId,
            reviewerId,
            notes
        });
    },

    /**
     * Deny a claim
     */
    async denyClaim(claimId, reviewerId, reason, notes = '') {
        return this.request('/deny-claim', 'POST', {
            claimId,
            reviewerId,
            reason,
            notes
        });
    },

    /**
     * Reassign a claim
     */
    async reassignClaim(claimId, fromReviewerId, toReviewerId, reason = '') {
        return this.request('/reassign-claim', 'POST', {
            claimId,
            fromReviewerId,
            toReviewerId,
            reason
        });
    },

    /**
     * Get reviewer information
     */
    async getReviewerInfo(reviewerId) {
        return this.request(`/reviewers/${reviewerId}`, 'GET');
    }
};

// Make API client available globally
window.apiClient = apiClient;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}
