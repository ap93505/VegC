# Deploying FreshVeg to Google Cloud Run

This guide will walk you through deploying the FreshVeg application to Google Cloud Run.

## Prerequisites

1.  **Google Cloud Platform Project**: Ensure you have a project set up.
2.  **Google Cloud SDK**: Install the `gcloud` CLI tool.
3.  **Billing Enabled**: Cloud Run requires billing to be enabled on your project.

## Steps

## Steps for GitHub Continuous Deployment

Since you have chosen to sync from GitHub, Google Cloud Build will automatically build and deploy your app whenever you push changes to your repository.

### 1. Prepare your Repository
1.  Ensure your `Dockerfile` and `.dockerignore` are committed and pushed to your GitHub repository.
2.  Your `package.json` must have the `"start"` script (which it does).

### 2. Create Service in Google Cloud Console
1.  Go to the [Google Cloud Console - Cloud Run](https://console.cloud.google.com/run).
2.  Click **"CREATE SERVICE"**.
3.  **Source**: Select **"Continuously deploy new revisions from a source repository"**.
4.  **Click "SET UP WITH CLOUD BUILD"**:
    -   **Repository Provider**: GitHub.
    -   **Repository**: Select your `VegC` repository.
    -   **Branch**: `^main$` (or your default branch).
    -   **Build Type**: Select **Dockerfile** (it should handle this automatically via your `Dockerfile`).
    -   Click **Save**.

### 3. Configure Service Settings
1.  **Service Name**: Enter a name (e.g., `vegc-app`).
2.  **Region**: Select a region (e.g., `asia-east1` for Taiwan or `us-central1`).
3.  **Authentication**: Select **"Allow unauthenticated invocations"** (so the public can visit your website).

### 4. Configure Environment Variables (CRITICAL)
**Before clicking Create**, you must expand the **"Container, Networking, Security"** section to add your secrets. If you skip this, the first deployment will fail (Application requires credentials to start).

1.  Click the arrow to expand **"Container, Networking, Security"**.
2.  Switch to the **"Variables & Secrets"** tab.
3.  Click **"ADD VARIABLE"** and add these from your `.env`:

    | Name | Value |
    |------|-------|
    | `GOOGLE_SHEET_ID` | Your Sheet ID |
    | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Your Service Account Email |
    | `ADMIN_PASSWORD` | Your Admin Password |
    | `GOOGLE_PRIVATE_KEY` | Copy the **ENTIRE** contents of your private key, including headers. |

4.  **Note**: The private key must be pasted exactly as is. Cloud Run handles the newlines.

### 5. Finalize
1.  Click **"CREATE"**.
2.  Google Cloud will now trigger a build. You can watch the progress in the "Revisions" or "Logs" tab.
3.  Once the build finishes (green checkmark), your URL will be active!

## How to Update
Just `git push` your changes to GitHub! Cloud Build will detect the change and auto-deploy new version.


## Troubleshooting

-   **500 Error / Crash**: Check the **Logs** tab in the Cloud Run Console.
    -   If you see "Error: error:0909006C:PEM routines:get_name:no start line", it means the `GOOGLE_PRIVATE_KEY` was pasted incorrectly. Ensure headers/footers are included and newlines are preserved.
-   **Mock Mode**: If the app says "Mock Mode", it means it cannot find or validate the Google credentials. Check your environment variables again.
