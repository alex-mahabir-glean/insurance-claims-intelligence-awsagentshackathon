/**
 * Cognito Authentication Helper
 * Handles user authentication with Amazon Cognito
 */

(function() {
    'use strict';

    // Load Cognito config
    const cognitoConfig = window.cognitoConfig || {};
    
    // Check if we have required config
    if (!cognitoConfig.userPoolId || !cognitoConfig.userPoolClientId || !cognitoConfig.region) {
        console.warn('Cognito configuration not loaded. Authentication disabled.');
        return;
    }

    // Cognito endpoints
    const COGNITO_DOMAIN = `cognito-idp.${cognitoConfig.region}.amazonaws.com`;
    
    // Session storage keys
    const STORAGE_KEYS = {
        ACCESS_TOKEN: 'cognito_access_token',
        ID_TOKEN: 'cognito_id_token',
        REFRESH_TOKEN: 'cognito_refresh_token',
        TOKEN_EXPIRY: 'cognito_token_expiry',
        USER_EMAIL: 'cognito_user_email'
    };

    /**
     * Initiate authentication with Cognito
     */
    async function initiateAuth(username, password) {
        const params = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: cognitoConfig.userPoolClientId,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password
            }
        };

        try {
            const response = await fetch(`https://${COGNITO_DOMAIN}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Authentication failed');
            }

            const data = await response.json();
            
            if (data.AuthenticationResult) {
                // Store tokens
                storeTokens(data.AuthenticationResult, username);
                return { success: true };
            } else if (data.ChallengeName) {
                return { success: false, challenge: data.ChallengeName };
            }
        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Store authentication tokens
     */
    function storeTokens(authResult, username) {
        const expiryTime = Date.now() + (authResult.ExpiresIn * 1000);
        
        sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authResult.AccessToken);
        sessionStorage.setItem(STORAGE_KEYS.ID_TOKEN, authResult.IdToken);
        sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResult.RefreshToken);
        sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
        sessionStorage.setItem(STORAGE_KEYS.USER_EMAIL, username);
    }

    /**
     * Check if user is authenticated
     */
    function isAuthenticated() {
        const accessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const expiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
        
        if (!accessToken || !expiry) {
            return false;
        }

        // Check if token is expired
        if (Date.now() >= parseInt(expiry)) {
            clearTokens();
            return false;
        }

        return true;
    }

    /**
     * Get current user info
     */
    function getCurrentUser() {
        if (!isAuthenticated()) {
            return null;
        }

        return {
            email: sessionStorage.getItem(STORAGE_KEYS.USER_EMAIL),
            accessToken: sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
            idToken: sessionStorage.getItem(STORAGE_KEYS.ID_TOKEN)
        };
    }

    /**
     * Sign out user
     */
    function signOut() {
        clearTokens();
        window.location.href = '/login.html';
    }

    /**
     * Clear all tokens
     */
    function clearTokens() {
        Object.values(STORAGE_KEYS).forEach(key => {
            sessionStorage.removeItem(key);
        });
    }

    /**
     * Require authentication - redirect to login if not authenticated
     */
    function requireAuth() {
        if (!isAuthenticated()) {
            // Store current page to redirect back after login
            sessionStorage.setItem('auth_redirect', window.location.pathname);
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    /**
     * Get redirect URL after login
     */
    function getRedirectUrl() {
        const redirect = sessionStorage.getItem('auth_redirect');
        sessionStorage.removeItem('auth_redirect');
        return redirect || '/index.html';
    }

    // Export functions to window
    window.CognitoAuth = {
        initiateAuth,
        isAuthenticated,
        getCurrentUser,
        signOut,
        requireAuth,
        getRedirectUrl
    };

})();
