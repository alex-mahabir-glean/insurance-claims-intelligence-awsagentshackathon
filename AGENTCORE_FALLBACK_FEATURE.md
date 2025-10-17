# AgentCore Fallback with Initial Message Feature

## Overview
When Glean is not configured and a user clicks approve/deny/AI assessment buttons, the system now automatically passes the intended message to the AgentCore direct chat. Once the user chooses to use AgentCore, subsequent button clicks will directly open the AgentCore chat without showing the fallback page again.

## Implementation Details

### Flow (First Time):
1. User clicks **Approve**, **Deny**, or **AI Assessment** button on a claim
2. System attempts to initialize Glean chat with an initial message
3. Glean not configured → Shows "Glean Agent Not Configured" fallback page
4. **NEW**: The initial message is stored in `pendingInitialMessage` variable
5. User clicks "Use AgentCore Direct Chat" button
6. **NEW**: `userChoseAgentCore` flag is set to `true`
7. AgentCore chat opens
8. **NEW**: The pending initial message is automatically:
   - Populated in the input field
   - Sent to the AgentCore agent
   - Displayed in the chat

### Flow (Subsequent Times):
1. User clicks **Approve**, **Deny**, or **AI Assessment** button again
2. System checks `userChoseAgentCore` flag → `true`
3. **NEW**: Bypasses fallback page entirely
4. **NEW**: Directly opens AgentCore chat
5. **NEW**: Auto-sends the new initial message
6. User can continue the conversation without interruption

### Reset Behavior:
- **Back Button**: Clicking "← Back" resets `userChoseAgentCore` to `false`, showing fallback page again
- **Refresh Button**: Clicking the refresh icon resets the choice and reinitializes the chat
- **Page Refresh**: Browser refresh naturally resets all JavaScript state

### Code Changes

#### File: `assets/js/reviewer.js`

**1. Added global variables:**
```javascript
let pendingInitialMessage = null; // Store initial message for AgentCore fallback
let userChoseAgentCore = false; // Track if user has chosen to use AgentCore
```

**2. Modified `renderGleanChatOverlay()` to check user choice and bypass fallback:**
```javascript
// Check if agent ID is a placeholder
if (isPlaceholderAgentId(agentId)) {
    // If user has already chosen AgentCore, skip fallback and go directly to chat
    if (userChoseAgentCore) {
        showAgentCoreChatOverlay();
        // Send the initial message if provided
        if (initialMessage) {
            setTimeout(() => {
                const input = document.getElementById('agentcore-input-overlay');
                if (input) {
                    input.value = initialMessage;
                    sendAgentCoreMessageOverlay();
                }
            }, 100);
        }
        return;
    }
    
    // Store the initial message for AgentCore fallback
    pendingInitialMessage = initialMessage;
    // ... rest of fallback UI
}
```

**3. Modified `showAgentCoreChatOverlay()` to set flag and auto-send pending message:**
```javascript
function showAgentCoreChatOverlay() {
    // Mark that user has chosen AgentCore
    userChoseAgentCore = true;
    
    // ... render chat UI ...
    
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
```

**4. Added reset logic to back button:**
```javascript
function backToFallbackMessageOverlay() {
    // Reset AgentCore choice when going back
    userChoseAgentCore = false;
    renderGleanChatOverlay();
}
```

**5. Added reset logic to refresh button:**
```javascript
chatRefresh.addEventListener('click', () => {
    // Reset AgentCore choice on refresh
    userChoseAgentCore = false;
    chatInitialized = false;
    // ... rest of refresh logic
});
```

## Example Messages

### AI Assessment Button:
**Initial Message**: "Please provide a comprehensive AI assessment for claim CL-20251016231234 and provide a recommendation, as well as reasoning."

### Approve Button:
**Initial Message**: (Would need to be implemented similarly)

### Deny Button:
**Initial Message**: (Would need to be implemented similarly)

## Testing Steps

1. Ensure Glean is NOT configured (use placeholder agent ID)
2. Go to reviewer.html page
3. Click on a claim to view details
4. Click "AI Assessment" button
5. Verify:
   - ✅ "Glean Agent Not Configured" message appears
   - ✅ "Use AgentCore Direct Chat" button is visible
6. Click "Use AgentCore Direct Chat"
7. Verify:
   - ✅ AgentCore chat interface opens
   - ✅ The AI assessment message is automatically sent
   - ✅ AgentCore responds with the assessment

## Future Enhancements

1. Add similar functionality for Approve and Deny buttons
2. Consider adding visual indicator that a message is being auto-sent
3. Add option to edit the message before sending
