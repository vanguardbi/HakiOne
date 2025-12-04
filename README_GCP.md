# Deploying LibreChat to Google Cloud Platform (GCP)

This guide provides the quickest way to deploy LibreChat to GCP using a Compute Engine VM and Docker Compose.

## Prerequisites

1.  **Google Cloud SDK (`gcloud`)**: Installed and authenticated on your local machine.
    *   [Install Guide](https://cloud.google.com/sdk/docs/install)
    *   Run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`.
2.  **Billing Enabled**: Your GCP project must have billing enabled.
3.  **Configuration Files**: Ensure you have the following files in your local directory:
    *   `.env` (Create from `.env.example` and configure your keys)
    *   `librechat.yaml` (Configure your AI endpoints)

## Quick Start

1.  **Review the Script**: Open `gcp_deploy.sh` and check the configuration variables at the top (Region, Machine Type, etc.).
    *   Default Machine Type: `e2-standard-2` (2 vCPU, 8GB RAM). This is recommended for running the full stack (API, MongoDB, MeiliSearch, Postgres).
    *   Default Zone: `us-central1-a`.

2.  **Run the Deployment Script**:
    Open your terminal (Git Bash or WSL on Windows, or standard terminal on Mac/Linux) and run:

    ```bash
    bash gcp_deploy.sh
    ```

    This script will:
    *   Create a new Compute Engine VM instance.
    *   Install Docker and Docker Compose automatically.
    *   Create the necessary folder structure on the VM.
    *   Copy your local config files (`.env`, `librechat.yaml`, `deploy-compose.yml`, `nginx.conf`) to the VM.
    *   Start the application using `docker compose`.

3.  **Access the Application**:
    The script will output the External IP address of your instance at the end.
    Open `http://<YOUR_INSTANCE_IP>` in your browser.

## Manual Steps (if script fails)

If you prefer to do this manually:

1.  **Create VM**: Create an Ubuntu 22.04 VM on Compute Engine. Allow HTTP/HTTPS traffic.
2.  **Install Docker**: SSH into the VM and install Docker Engine & Docker Compose.
3.  **Copy Files**: Copy `deploy-compose.yml`, `.env`, `librechat.yaml`, and `client/nginx.conf` to the VM.
4.  **Run**:
    ```bash
    docker compose -f deploy-compose.yml up -d
    ```

## Troubleshooting

*   **Permissions**: Ensure your `.env` file has the correct permissions and values.
*   **Firewall**: If you cannot access the site, ensure the "Allow HTTP traffic" checkbox was selected when creating the instance (the script adds the `http-server` tag automatically).
*   **Logs**: To check logs, SSH into the instance and run:
    ```bash
    cd ~/librechat
    sudo docker compose -f deploy-compose.yml logs -f
    ```
