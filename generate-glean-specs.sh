#!/bin/bash

# =============================================================================
# Generate Glean OpenAPI Specifications with Deployment-Specific URLs
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if deployment-outputs.json exists
if [ ! -f "deployment-outputs.json" ]; then
    echo -e "${YELLOW}⚠️  deployment-outputs.json not found.${NC}"
    echo -e "${YELLOW}   Please run ./deploy.sh first to deploy the infrastructure.${NC}"
    exit 1
fi

# Extract API URL from deployment outputs
API_URL=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['apiUrl'])")

echo -e "${BLUE}Generating Glean OpenAPI specifications...${NC}"
echo -e "${BLUE}API URL: ${YELLOW}$API_URL${NC}"
echo ""

# Create output directory
mkdir -p glean/generated

# Process each OpenAPI spec
for spec_file in glean/openapi-*.json; do
    if [ -f "$spec_file" ]; then
        filename=$(basename "$spec_file")
        output_file="glean/generated/$filename"
        
        # Replace the API URL placeholder
        sed "s|https://[a-z0-9]*\.execute-api\.[a-z0-9-]*\.amazonaws\.com/prod|$API_URL|g" "$spec_file" > "$output_file"
        
        echo -e "${GREEN}✓ Generated: $output_file${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ All Glean OpenAPI specifications generated!${NC}"
echo -e "${BLUE}📁 Files are in: ${YELLOW}glean/generated/${NC}"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo -e "  1. Go to Glean Admin Console → Actions"
echo -e "  2. Import the generated OpenAPI specs from ${YELLOW}glean/generated/${NC}"
echo -e "  3. Configure authentication (see GLEAN_SETUP.md for details)"
echo ""
