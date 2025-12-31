#!/bin/zsh
# Auto-start script for YouTube Downloader Local Server
# This script can be added to your system startup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found. Please install Python 3.7+"
    exit 1
fi

# Check if server is already running
if lsof -ti:8765 &> /dev/null; then
    echo "Server is already running on port 8765"
    exit 0
fi

# Start the server
echo "Starting YouTube Downloader Local Server..."
python3 server.py

