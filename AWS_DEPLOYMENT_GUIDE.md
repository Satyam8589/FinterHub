# FinterHub AWS Deployment Guide

## Prerequisites
- Docker installed
- AWS CLI configured
- AWS account with ECR and ECS access

---

## Step 1: Build and Test Docker Image Locally

```bash
# Navigate to backend directory
cd backend

# Build Docker image
docker build -t finterhub-backend:latest .

# Test the image locally
docker run -p 5000:5000 \
  -e MONGO_URL="your_mongo_url" \
  -e JWT_SECRET="your_jwt_secret" \
  finterhub-backend:latest
```

---

## Step 2: Test with Docker Compose (Optional)

```bash
# Create .env file in root directory with:
# MONGO_URL=mongodb://mongodb:27017/finterHub
# JWT_SECRET=your_secret_key
# MONGO_USERNAME=admin
# MONGO_PASSWORD=password

# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

---

## Step 3: Push to AWS ECR

```bash
# Login to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository (first time only)
aws ecr create-repository --repository-name finterhub-backend --region us-east-1

# Tag your image
docker tag finterhub-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/finterhub-backend:latest

# Push to ECR
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/finterhub-backend:latest
```

---

## Step 4: Deploy to AWS ECS (Fargate)

### Option A: Using AWS Console
1. Go to ECS → Create Cluster
2. Choose Fargate
3. Create Task Definition with your ECR image
4. Set environment variables (MONGO_URL, JWT_SECRET)
5. Create Service and deploy

### Option B: Using AWS CLI

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name finterhub-cluster --region us-east-1

# Register task definition (create task-definition.json first)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster finterhub-cluster \
  --service-name finterhub-backend-service \
  --task-definition finterhub-backend:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

---

## Step 5: Set Up MongoDB Atlas (Recommended)

Instead of managing MongoDB yourself:

1. Create free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Update MONGO_URL environment variable in ECS task definition
4. Whitelist AWS IP ranges in Atlas

---

## Step 6: Configure Environment Variables in ECS

In your ECS Task Definition, add:
```json
"environment": [
  {
    "name": "NODE_ENV",
    "value": "production"
  },
  {
    "name": "PORT",
    "value": "5000"
  },
  {
    "name": "MONGO_URL",
    "value": "your_mongodb_atlas_url"
  },
  {
    "name": "JWT_SECRET",
    "value": "your_secure_jwt_secret"
  }
]
```

Or use AWS Secrets Manager for sensitive data:
```json
"secrets": [
  {
    "name": "MONGO_URL",
    "valueFrom": "arn:aws:secretsmanager:region:account-id:secret:mongo-url"
  },
  {
    "name": "JWT_SECRET",
    "valueFrom": "arn:aws:secretsmanager:region:account-id:secret:jwt-secret"
  }
]
```

---

## Step 7: Set Up Load Balancer (Optional but Recommended)

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name finterhub-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx

# Create target group
aws elbv2 create-target-group \
  --name finterhub-targets \
  --protocol HTTP \
  --port 5000 \
  --vpc-id vpc-xxxxx \
  --target-type ip

# Update ECS service to use load balancer
aws ecs update-service \
  --cluster finterhub-cluster \
  --service finterhub-backend-service \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=finterhub-backend,containerPort=5000
```

---

## Step 8: Continuous Deployment (Optional)

### Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: finterhub-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster finterhub-cluster --service finterhub-backend-service --force-new-deployment
```

---

## Cost Estimation (AWS Free Tier)

- **ECS Fargate**: ~$15-30/month (0.25 vCPU, 0.5 GB RAM)
- **MongoDB Atlas**: Free (M0 cluster, 512MB)
- **ECR**: Free for 500MB storage
- **ALB**: ~$16/month (optional)

**Total**: ~$15-46/month

---

## Alternative: Deploy to AWS EC2 (Cheaper)

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install Docker
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Pull and run your image
docker pull YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/finterhub-backend:latest
docker run -d -p 5000:5000 \
  -e MONGO_URL="your_mongo_url" \
  -e JWT_SECRET="your_jwt_secret" \
  --restart unless-stopped \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/finterhub-backend:latest
```

---

## Monitoring and Logs

```bash
# View ECS logs
aws logs tail /ecs/finterhub-backend --follow

# View running tasks
aws ecs list-tasks --cluster finterhub-cluster

# Describe service
aws ecs describe-services --cluster finterhub-cluster --services finterhub-backend-service
```

---

## Health Check Endpoint (Recommended to Add)

Add this to your `server.js`:

```javascript
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
```

---

## Security Checklist

- ✅ Use HTTPS (set up SSL certificate with AWS Certificate Manager)
- ✅ Store secrets in AWS Secrets Manager
- ✅ Enable VPC for ECS tasks
- ✅ Configure security groups (only allow necessary ports)
- ✅ Use MongoDB Atlas with IP whitelisting
- ✅ Enable CloudWatch logging
- ✅ Set up IAM roles with least privilege

---

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Set up monitoring and alerts
3. ✅ Configure auto-scaling (if needed)
4. ✅ Set up CI/CD pipeline
5. ✅ Continue development with new features
6. ✅ Deploy frontend to AWS S3 + CloudFront

---

## Quick Commands Reference

```bash
# Build image
docker build -t finterhub-backend ./backend

# Run locally
docker run -p 5000:5000 finterhub-backend

# Push to ECR
docker tag finterhub-backend:latest ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/finterhub-backend:latest
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/finterhub-backend:latest

# Update ECS service
aws ecs update-service --cluster finterhub-cluster --service finterhub-backend-service --force-new-deployment
```

---

**Yes, you can absolutely deploy now and continue development!** The Docker setup allows you to:
- Deploy current stable version to AWS
- Continue local development
- Push updates when ready
- Roll back if needed

Your backend is production-ready with authentication, groups, and expenses functionality! 🚀
