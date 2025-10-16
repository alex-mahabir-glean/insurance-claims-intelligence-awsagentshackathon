# Deployment Utilities

This directory contains testing and utility scripts for the deployed system.

## 📁 Contents

### Testing Scripts

- **`test_agent_invocation.py`** - Test AgentCore agents directly via boto3
  ```bash
  python3 test_agent_invocation.py
  ```

- **`test_api_endpoint.sh`** - Test API Gateway endpoints
  ```bash
  ./test_api_endpoint.sh
  ```

### Cleanup

To remove all deployed resources, use the cleanup script at the project root:

```bash
cd ..
./cleanup.sh
```

### Workspace

- **`agentcore-deploy/`** - AgentCore deployment workspace
  - Created automatically during deployment
  - Contains agent code and configuration
  - `.bedrock_agentcore.yaml` files (gitignored)

---

## 🚀 Main Deployment

**For deploying the system, use the main deployment script at the project root:**

```bash
cd ..
./deploy.sh
```

See the [main README](../README.md) for complete deployment instructions.

---

## 📋 Prerequisites

These scripts require:
- Completed deployment (run `../deploy.sh` first)
- `deployment-outputs.json` in project root
- AWS credentials configured
- Python 3.10+

---

## 🔍 Verification

After deployment, verify everything works:

```bash
# From project root
./verify-deployment.sh

# Then test from this directory
cd deployment
python3 test_agent_invocation.py
./test_api_endpoint.sh
```

---

**For full documentation, see:**
- [Main README](../README.md)
- [Quick Reference](../QUICK_REFERENCE.md)
- [Glean Setup](../GLEAN_SETUP.md)
