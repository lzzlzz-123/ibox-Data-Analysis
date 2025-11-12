# Docker Build Fix for Frontend

## Problem
The frontend Dockerfile was failing with the error:
```
ERROR: failed to compute cache key: "/frontend": not found
```

## Root Cause
The Dockerfile was written assuming the build context was the project root (with paths like `COPY frontend/...`), but when built from the frontend directory itself, these paths were incorrect.

Additionally, the package-lock.json file was causing npm to install packages in an invalid state, where vite was installed but node_modules/.bin/ directory was not created.

## Solution

### 1. Updated docker-compose.yml
Changed the build context for both frontend and backend services to use their respective directories:

**Frontend:**
- Before: `context: .` and `dockerfile: frontend/Dockerfile`
- After: `context: ./frontend` and `dockerfile: Dockerfile`

**Backend:**
- Before: `context: .` and `dockerfile: backend/Dockerfile`
- After: `context: ./backend` and `dockerfile: Dockerfile`

### 2. Updated Dockerfiles
Changed COPY paths to be relative to their service directories:

**Frontend Dockerfile:**
- Before: `COPY frontend/package*.json ./` and `COPY frontend/ ./`
- After: `COPY package.json ./` and `COPY src ./src` (with explicit file copies)

**Backend Dockerfile:**
- Before: `COPY backend/package*.json ./` and `COPY backend/src ./src`
- After: `COPY package*.json ./` and `COPY src ./src`

### 3. Package Management
Changed from `npm ci` to `npm install` and only copy package.json (not package-lock.json) to avoid dependency installation issues.

### 4. Added .dockerignore Files
Created .dockerignore files in both frontend/ and backend/ directories to exclude unnecessary files from the Docker build context (node_modules, tests, etc.).

## Benefits
- Dockerfiles can now be built from their respective service directories
- Cleaner, more maintainable Docker configuration
- Faster builds due to proper .dockerignore exclusions
- Consistent pattern between frontend and backend services
