# Agent Backend - Build Troubleshooting Guide

## 🚨 Issue: Cloud Build Using Buildpacks Instead of Custom Dockerfile

### Problem
Your Cloud Build logs show:
```
Starting Step #0 - "Buildpack"
Pulling image: gcr.io/k8s-skaffold/pack
```

This means the Cloud Build trigger is **NOT using our custom `cloudbuild.yaml`**. Instead, it's using Google's buildpacks which tries to auto-detect the build configuration.

### Root Cause
When you create a Cloud Run service via the **Cloud Run UI** and connect it to GitHub, it automatically creates a Cloud Build trigger configured to use **buildpacks** instead of our custom Dockerfile and cloudbuild.yaml.

## ✅ Solution: Reconfigure the Trigger

### Option 1: Delete and Recreate Trigger (Recommended)

#### Step 1: Delete the Existing Trigger

```bash
# List all triggers to find the agent-backend trigger
gcloud builds triggers list --project=ph-senate

# Delete the incorrect trigger (replace TRIGGER_ID with actual ID)
gcloud builds triggers delete TRIGGER_ID --project=ph-senate
```

**Or via Console:**
1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=ph-senate)
2. Find the trigger for agent-backend
3. Click the 3-dot menu → **Delete**

#### Step 2: Import Our Custom Trigger

```bash
cd /Users/ray/repos/CarbonSync/viza-monorepo

# Import the properly configured trigger
gcloud builds triggers import \
  --source=agent-backend/trigger-config.yaml \
  --project=ph-senate
```

#### Step 3: Verify the Configuration

```bash
# List triggers and verify the new one
gcloud builds triggers describe agent-backend-staging --project=ph-senate

# Should show:
# - filename: agent-backend/cloudbuild.yaml
# - includedFiles: agent-backend/**
```

### Option 2: Edit Existing Trigger via Console

If you prefer to keep the existing trigger:

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=ph-senate)
2. Find your agent-backend trigger
3. Click **EDIT**
4. Change these settings:
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Cloud Build configuration file location**: `/agent-backend/cloudbuild.yaml`
   - **Included files filter**: `agent-backend/**`
5. Click **SAVE**

## 🔧 Additional Fix: Package Lock File

The build also failed due to LangChain peer dependency conflicts. This has been fixed:

### What was done:
1. Regenerated `package-lock.json` with `--legacy-peer-deps`
2. Updated `Dockerfile.cloudrun` to use `npm ci --legacy-peer-deps`

### Verify the fix:
```bash
cd /Users/ray/repos/CarbonSync/viza-monorepo/agent-backend
git status
# Should show modified: package-lock.json
```

## 🚀 Deploy with Fixed Configuration

Once the trigger is reconfigured:

```bash
cd /Users/ray/repos/CarbonSync/viza-monorepo

# Stage the fixed files
git add agent-backend/package-lock.json \
        agent-backend/Dockerfile.cloudrun \
        agent-backend/TROUBLESHOOT_BUILD.md

# Commit
git commit -m "fix(agent-backend): resolve build issues

- Fix LangChain peer dependency conflicts with --legacy-peer-deps
- Update Dockerfile to use --legacy-peer-deps during npm ci
- Regenerate package-lock.json with resolved dependencies"

# Push to trigger deployment
git push origin main
```

## 🔍 Verify the Build Uses Correct Configuration

When the build runs correctly, you should see in the logs:

```
Starting Step #0 - "Build"
name: gcr.io/cloud-builders/docker
args:
  - build
  - --no-cache
  - -t
  - asia-southeast1-docker.pkg.dev/ph-senate/cloud-run-source-deploy/...
  - agent-backend
  - -f
  - agent-backend/Dockerfile.cloudrun
```

**NOT:**
```
Starting Step #0 - "Buildpack"
Pulling image: gcr.io/k8s-skaffold/pack
```

## 📊 Expected Build Steps

With the correct configuration, the build will have 3 steps:

1. **Build** - Docker builds the image using `Dockerfile.cloudrun`
2. **Push** - Push image to Artifact Registry
3. **Deploy** - Deploy to Cloud Run with proper configuration

## ⚙️ Why Buildpacks Failed

Buildpacks tried to auto-detect the build configuration and ran into issues:

1. **Peer Dependency Conflicts**: 
   - `@langchain/core@1.1.3` installed
   - `@langchain/google-genai@1.0.3` requires exactly `@langchain/core@1.0.6`
   - Buildpacks run `npm ci` without `--legacy-peer-deps`

2. **No Build Customization**:
   - Buildpacks can't be configured to use `--legacy-peer-deps`
   - Our custom Dockerfile handles this properly

## 🎯 Quick Checklist

Before pushing again, ensure:

- [ ] Old trigger deleted or reconfigured to use `cloudbuild.yaml`
- [ ] `package-lock.json` regenerated with `--legacy-peer-deps`
- [ ] `Dockerfile.cloudrun` updated with `--legacy-peer-deps`
- [ ] Changes committed and ready to push
- [ ] Trigger configured with:
  - Build type: Cloud Build configuration file
  - Location: `/agent-backend/cloudbuild.yaml`
  - Included files: `agent-backend/**`

## 🆘 Still Having Issues?

### Check the trigger configuration:
```bash
gcloud builds triggers describe agent-backend-staging \
  --project=ph-senate \
  --format=yaml
```

Should show:
```yaml
filename: agent-backend/cloudbuild.yaml
includedFiles:
- agent-backend/**
```

### Manually trigger a build to test:
```bash
gcloud builds submit \
  --config=agent-backend/cloudbuild.yaml \
  --project=ph-senate \
  --substitutions=_SERVICE_NAME=agent-backend-staging
```

### View detailed logs:
```bash
# Get latest build
BUILD_ID=$(gcloud builds list --project=ph-senate --limit=1 --format='value(id)')

# View logs
gcloud builds log $BUILD_ID --project=ph-senate
```

---

**Status**: Ready to fix and redeploy
**Last Updated**: January 7, 2026

