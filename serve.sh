#!/bin/bash

# =============================================================================
# Local Web Server for HTML Portals
# Serves submitter.html and reviewer.html on localhost
# =============================================================================

# Load port from config.env if available
if [ -f "config.env" ]; then
    source config.env
fi

PORT="${LOCAL_SERVER_PORT:-8000}"

echo "🌐 Starting local web server..."
echo ""
echo "📋 Available portals:"
echo "  • Claimant Portal:  http://localhost:$PORT/submitter.html"
echo "    (File new insurance claims with AI assistance)"
echo ""
echo "  • Reviewer Portal:  http://localhost:$PORT/reviewer.html"
echo "    (Review, approve, deny, and manage claims)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python HTTP server
python3 -m http.server "$PORT"
