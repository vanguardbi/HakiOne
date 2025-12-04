#!/bin/bash

# Exit on error
set -e

# Configuration
INSTANCE_NAME="haki-one"
MACHINE_TYPE="e2-standard-2" # 2 vCPU, 8GB RAM recommended for full stack
ZONE="africa-south1-a"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
PROJECT_ID=$(gcloud config get-value project)

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it and authenticate."
    exit 1
fi

echo "Using Project ID: $PROJECT_ID"
echo "Creating Compute Engine instance..."

# Create the instance with a startup script to install Docker
gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=$IMAGE_FAMILY \
    --image-project=$IMAGE_PROJECT \
    --tags=http-server,https-server \
    --metadata=startup-script='#! /bin/bash
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
'

echo "Instance created. Waiting for startup script to finish (approx 2-3 mins)..."
echo "You can check the serial port output in GCP Console if needed."

# Wait loop for Docker to be ready
echo "Waiting for Docker to be available on the instance..."
RETRIES=0
MAX_RETRIES=30
while ! gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="sudo docker info" &> /dev/null; do
    echo "Docker not ready yet... waiting 10s ($RETRIES/$MAX_RETRIES)"
    sleep 10
    RETRIES=$((RETRIES+1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        echo "Timed out waiting for Docker. Please check the instance manually."
        exit 1
    fi
done

echo "Docker is ready!"

# Create directory structure
echo "Setting up directory structure..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="mkdir -p ~/librechat/client ~/librechat/images ~/librechat/uploads ~/librechat/logs ~/librechat/data-node ~/librechat/meili_data_v1.12 ~/librechat/pgdata2"

# Prepare source code archive
echo "Compressing source code (excluding node_modules, .git, etc)..."
# Using tar to create a clean archive of the source
tar -czf source.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=data-node \
    --exclude=meili_data_v1.12 \
    --exclude=pgdata2 \
    --exclude=uploads \
    --exclude=logs \
    --exclude=dist \
    --exclude=.vscode \
    .

# Copy files
echo "Copying source code and configuration..."
gcloud compute scp source.tar.gz $INSTANCE_NAME:~/librechat/ --zone=$ZONE
gcloud compute scp .env $INSTANCE_NAME:~/librechat/ --zone=$ZONE

# Extract and Start
echo "Extracting source and starting LibreChat..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="cd ~/librechat && tar -xzf source.tar.gz && rm source.tar.gz && sudo docker compose -f deploy-compose.yml up -d --build"

# Cleanup local archive
rm source.tar.gz

echo "Deployment complete!"
echo "Get your instance IP address:"
gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
