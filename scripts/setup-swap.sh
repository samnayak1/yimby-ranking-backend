#!/usr/bin/env bash
# One-time host setup for a 1 GiB instance (t3a.micro / t3.micro).
# Docker image builds (tsc + vite) need more RAM than the box has; swap covers
# the peak. Runtime does not touch this.
set -euo pipefail

SWAPFILE=/swapfile
SIZE_GB=2

if swapon --show | grep -q "$SWAPFILE"; then
  echo "swap already active:"; swapon --show; exit 0
fi

echo "Allocating ${SIZE_GB}G at $SWAPFILE..."
sudo fallocate -l "${SIZE_GB}G" "$SWAPFILE" || \
  sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=$((SIZE_GB * 1024))
sudo chmod 600 "$SWAPFILE"
sudo mkswap "$SWAPFILE"
sudo swapon "$SWAPFILE"

# Persist across reboots.
grep -q "^$SWAPFILE" /etc/fstab || \
  echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab

# Only swap under real pressure; keep the DB page cache resident.
sudo sysctl -w vm.swappiness=10
grep -q "^vm.swappiness" /etc/sysctl.conf || \
  echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf

echo "Done:"; free -h
