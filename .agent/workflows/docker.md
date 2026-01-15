---
description: Docker setup and common commands for FinterHub
---

# Docker Setup for FinterHub

## Initial Setup

### 1. Configure Environment Variables
Copy the `.env.docker` template and update with your actual values:
```bash
cp .env.docker .env
```

Edit `.env` and update:
- `MONGO_PASSWORD`: Set a strong password for MongoDB
- `JWT_SECRET`: Set a secure JWT secret key
- `FRONTEND_URL`: Update if your frontend runs on a different URL

### 2. Build and Start Services
// turbo
```bash
docker-compose up -d --build
```

This will:
- Build the backend Docker image
- Pull the MongoDB image
- Start both services in detached mode
- Create persistent volumes for MongoDB data

### 3. Verify Services are Running
// turbo
```bash
docker-compose ps
```

### 4. Check Service Health
// turbo
```bash
docker-compose logs backend
```

## Common Docker Commands

### Starting Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d backend
docker-compose up -d mongodb
```

### Stopping Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### Viewing Logs
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs backend
docker-compose logs mongodb

# Follow logs for specific service
docker-compose logs -f backend
```

### Rebuilding Services
```bash
# Rebuild and restart all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend

# Force rebuild (no cache)
docker-compose build --no-cache
docker-compose up -d
```

### Accessing Containers
```bash
# Execute command in backend container
docker-compose exec backend sh

# Execute command in MongoDB container
docker-compose exec mongodb mongosh

# Run npm commands in backend
docker-compose exec backend npm run db:list
```

### Monitoring and Debugging
```bash
# Check container status
docker-compose ps

# View resource usage
docker stats

# Inspect container
docker inspect finterhub-backend
docker inspect finterhub-mongodb

# View container processes
docker-compose top
```

### Database Management
```bash
# Access MongoDB shell
docker-compose exec mongodb mongosh -u admin -p your_password --authenticationDatabase admin

# Backup MongoDB data
docker-compose exec mongodb mongodump --out /data/backup

# Restore MongoDB data
docker-compose exec mongodb mongorestore /data/backup
```

### Cleaning Up
```bash
# Remove stopped containers
docker-compose rm

# Remove all unused containers, networks, images
docker system prune

# Remove all unused volumes (WARNING: deletes data)
docker volume prune

# Complete cleanup (WARNING: removes everything)
docker system prune -a --volumes
```

### Updating Services
```bash
# Pull latest images
docker-compose pull

# Rebuild and restart with latest code
docker-compose down
docker-compose up -d --build
```

## Docker Hub (Image Registry)

### Push Image to Docker Hub
```bash
# Login to Docker Hub
docker login

# Build the image
docker-compose build backend

# Tag the image
docker tag finterhub-backend:latest satyam8589/finterhub-backend:latest
docker tag finterhub-backend:latest satyam8589/finterhub-backend:v1.0.0

# Push to Docker Hub
docker push satyam8589/finterhub-backend:latest
docker push satyam8589/finterhub-backend:v1.0.0
```

### Pull Image from Docker Hub
```bash
# Pull specific version
docker pull satyam8589/finterhub-backend:latest
docker pull satyam8589/finterhub-backend:v1.0.0

# Use in docker-compose (edit docker-compose.yml)
# Change: build: ./backend
# To: image: satyam8589/finterhub-backend:latest
```

### Deploy Using Docker Hub Image
```bash
# Use production compose file (pulls from Docker Hub)
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```


## Health Checks

### Check Backend Health
```bash
curl http://localhost:5000/health
```

### Check MongoDB Connection
```bash
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

## Troubleshooting

### Backend won't start
1. Check logs: `docker-compose logs backend`
2. Verify MongoDB is healthy: `docker-compose ps`
3. Check environment variables in `.env`
4. Ensure MongoDB is accessible: `docker-compose exec backend ping mongodb`

### MongoDB connection issues
1. Verify MongoDB is running: `docker-compose ps mongodb`
2. Check MongoDB logs: `docker-compose logs mongodb`
3. Verify credentials in `.env` match MongoDB configuration
4. Test connection: `docker-compose exec mongodb mongosh -u admin -p password`

### Port conflicts
1. Check if ports are already in use:
   - Windows: `netstat -ano | findstr :5000`
   - Windows: `netstat -ano | findstr :27017`
2. Update ports in `docker-compose.yml` if needed

### Performance issues
1. Check resource usage: `docker stats`
2. Increase Docker Desktop memory/CPU limits
3. Check logs for errors: `docker-compose logs -f`

## Production Deployment

For production deployment to EC2 or other servers:

1. Update `.env` with production values
2. Set `NODE_ENV=production`
3. Use strong passwords and secrets
4. Configure proper CORS settings
5. Set up SSL/TLS certificates
6. Configure firewall rules
7. Set up monitoring and logging
8. Regular backups of MongoDB volumes

## Quick Reference

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Restart backend after code changes
docker-compose restart backend

# Stop everything
docker-compose down

# Rebuild after major changes
docker-compose down && docker-compose up -d --build
```
