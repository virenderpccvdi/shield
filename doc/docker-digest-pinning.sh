#!/bin/bash
# Run this script to get current digest values for pinning
IMAGES=("eclipse-temurin:21-jre-alpine" "python:3.12-slim" "node:20-alpine")
for img in "${IMAGES[@]}"; do
  echo "=== $img ==="
  docker pull "$img" --quiet
  docker inspect --format='FROM {{index .RepoDigests 0}}' "$img"
done
