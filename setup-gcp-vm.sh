#!/bin/bash
set -e

echo "=== Setting up GCP VM for Asterisk ==="

# Update system packages
echo "Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
echo "Installing required packages..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    htop \
    iftop \
    iotop \
    sysstat

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo \
        "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    newgrp docker
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Configure system limits
echo "Configuring system limits..."
sudo tee -a /etc/security/limits.conf > /dev/null <<EOL
* soft nofile 100000
* hard nofile 100000
* soft nproc 65535
* hard nproc 65535
EOL

# Configure sysctl settings
echo "Configuring kernel parameters..."
sudo tee -a /etc/sysctl.conf > /dev/null <<EOL
# System file descriptor limits
fs.file-max = 100000
fs.nr_open = 100000

# Network settings
net.core.somaxconn = 32768
net.core.netdev_max_backlog = 10000
net.ipv4.tcp_max_syn_backlog = 10000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65000
net.ipv4.tcp_fin_timeout = 30

# Increase the maximum amount of memory used for socket receive buffers
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# Enable TCP Fast Open
net.ipv4.tcp_fastopen = 3
EOL

# Apply sysctl settings
sudo sysctl -p

# Configure Docker daemon
echo "Configuring Docker daemon..."
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOL
{
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 100000,
      "Soft": 100000
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOL

# Restart Docker to apply changes
echo "Restarting Docker daemon..."
sudo systemctl restart docker

# Create swap file if swap is not already configured
if ! swapon --show; then
    echo "Creating swap file..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "=== GCP VM setup complete! ==="
echo "Please log out and log back in for all changes to take effect."
echo "After logging back in, you can start the application with:"
echo "  docker-compose up -d"
echo "To monitor the system, you can use:"
echo "  htop        # System monitoring"
echo "  iftop       # Network traffic monitoring"
echo "  iotop -o    # Disk I/O monitoring"
echo "  docker stats"
