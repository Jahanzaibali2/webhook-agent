#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is running
check_docker() {
    if ! docker ps &> /dev/null; then
        echo -e "${RED}Docker is not running!${NC}"
        exit 1
    fi
}

# Check Asterisk container status
check_asterisk_status() {
    echo -e "\n${YELLOW}=== Asterisk Container Status ===${NC}"
    docker ps -f name=ubl-asterisk --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    if ! docker ps | grep -q ubl-asterisk; then
        echo -e "${RED}Asterisk container is not running!${NC}"
        return 1
    fi
    return 0
}

# Check system resources
check_resources() {
    echo -e "\n${YELLOW}=== System Resources ===${NC}"
    echo -e "CPU Load: $(cat /proc/loadavg | awk '{print $1}')"
    echo -e "Memory Usage:"
    free -h | grep -v "total"
    echo -e "\nDisk Usage:"
    df -h | grep -v "loop"
}

# Check network connections
check_network() {
    echo -e "\n${YELLOW}=== Network Connections ===${NC}"
    echo -e "Active connections on SIP ports (5060-5061):"
    sudo netstat -tulpn | grep -E '5060|5061'
    
    echo -e "\nActive RTP ports (10000-20000):"
    sudo netstat -tulpn | grep -E '10000|20000' | head -n 5
    echo "... (showing first 5 RTP ports, more may be in use)"
}

# Check Asterisk status
check_asterisk_health() {
    if ! check_asterisk_status; then
        return
    fi
    
    echo -e "\n${YELLOW}=== Asterisk Status ===${NC}"
    
    # Basic version check
    echo -e "\n${GREEN}Asterisk Version:${NC}"
    docker exec ubl-asterisk asterisk -rx "core show version" 2>/dev/null || echo "Failed to get version"
    
    # SIP peers
    echo -e "\n${GREEN}SIP Peers:${NC}"
    docker exec ubl-asterisk asterisk -rx "sip show peers" 2>/dev/null || echo "Failed to get SIP peers"
    
    # Active calls
    echo -e "\n${GREEN}Active Calls:${NC}"
    docker exec ubl-asterisk asterisk -rx "core show calls" 2>/dev/null || echo "Failed to get active calls"
    
    # Channel status
    echo -e "\n${GREEN}Channel Status:${NC}"
    docker exec ubl-asterisk asterisk -rx "core show channels" 2>/dev/null || echo "Failed to get channel status"
    
    # Memory usage
    echo -e "\n${GREEN}Memory Usage:${NC}"
    docker exec ubl-asterisk asterisk -rx "core show sysinfo" 2>/dev/null | grep -E 'Memory|CPU' || echo "Failed to get memory info"
}

# Check logs
check_logs() {
    echo -e "\n${YELLOW}=== Recent Logs (last 10 lines) ===${NC}"
    docker logs --tail=10 ubl-asterisk 2>&1 | tail -n 20
}

# Main function
main() {
    check_docker
    check_resources
    check_network
    check_asterisk_health
    check_logs
    
    echo -e "\n${GREEN}=== Monitoring Complete ===${NC}"
    echo -e "Run 'docker logs -f ubl-asterisk' to follow logs in real-time"
    echo -e "Run 'htop' for system monitoring"
    echo -e "Run 'iftop' for network traffic monitoring"
}

# Execute main function
main
