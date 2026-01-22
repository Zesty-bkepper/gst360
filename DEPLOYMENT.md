# GST360 AWS Deployment Guide

This guide explains how to deploy the GST360 application to AWS using ECS Fargate with RDS PostgreSQL.

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                        AWS Cloud                         │
                    │                                                          │
    Internet        │    ┌──────────────────────────────────────────────┐     │
        │           │    │              Application Load Balancer        │     │
        │           │    │                                              │     │
        └───────────┼────►  /api/* → Backend Target Group               │     │
                    │    │  /*     → Frontend Target Group              │     │
                    │    └──────────────────────────────────────────────┘     │
                    │                      │                                   │
                    │         ┌────────────┴────────────┐                     │
                    │         │                         │                     │
                    │         ▼                         ▼                     │
                    │  ┌─────────────┐          ┌─────────────┐               │
                    │  │   Backend   │          │  Frontend   │               │
                    │  │   (Fargate) │          │  (Fargate)  │               │
                    │  │   Port 8000 │          │   Port 80   │               │
                    │  └──────┬──────┘          └─────────────┘               │
                    │         │                                               │
                    │         │                                               │
                    │  ┌──────▼──────┐     ┌─────────────┐                   │
                    │  │    RDS      │     │     S3      │                   │
                    │  │  PostgreSQL │     │   Bucket    │                   │
                    │  └─────────────┘     └─────────────┘                   │
                    │                                                          │
                    └──────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS CLI** installed and configured with appropriate credentials
2. **Docker** installed and running
3. **AWS Account** with permissions to create:
   - VPC, Subnets, Security Groups
   - ECS Cluster, Services, Task Definitions
   - RDS PostgreSQL instance
   - S3 Bucket
   - Application Load Balancer
   - IAM Roles
   - CloudWatch Log Groups
   - Secrets Manager secrets

## Quick Deployment

### 1. Set Environment Variables

```bash
export AWS_REGION=ap-south-1          # Your preferred region
export DB_PASSWORD=your_secure_password_here
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### 2. Run Deployment Script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This will:
- Deploy CloudFormation infrastructure (VPC, RDS, ECS Cluster, ALB, S3)
- Create IAM roles for ECS tasks
- Store secrets in AWS Secrets Manager
- Build and push Docker images to ECR
- Deploy ECS services

## Manual Deployment Steps

### Step 1: Deploy Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name gst360-infrastructure \
  --template-body file://aws/cloudformation-infrastructure.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=gst360 \
    ParameterKey=DBUsername,ParameterValue=gst360admin \
    ParameterKey=DBPassword,ParameterValue=YOUR_PASSWORD \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1
```

Wait for completion:
```bash
aws cloudformation wait stack-create-complete --stack-name gst360-infrastructure
```

### Step 2: Get Stack Outputs

```bash
aws cloudformation describe-stacks --stack-name gst360-infrastructure \
  --query "Stacks[0].Outputs" --output table
```

### Step 3: Build and Push Docker Images

```bash
# Login to ECR
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com

# Build and push backend
docker build -t gst360-backend -f backend/Dockerfile .
docker tag gst360-backend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com/gst360-backend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com/gst360-backend:latest

# Build and push frontend (with API URL)
ALB_DNS=$(aws cloudformation describe-stacks --stack-name gst360-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" --output text)

docker build -t gst360-frontend \
  --build-arg VITE_API_URL=http://${ALB_DNS} \
  -f frontend/Dockerfile frontend/
docker tag gst360-frontend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com/gst360-frontend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com/gst360-frontend:latest
```

### Step 4: Store Secrets

```bash
# Get database endpoint
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name gst360-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)

# Create secrets
aws secretsmanager create-secret --name gst360/database-url \
  --secret-string "postgresql://gst360admin:YOUR_PASSWORD@${DB_ENDPOINT}:5432/gst360"

aws secretsmanager create-secret --name gst360/anthropic-api-key \
  --secret-string "sk-ant-api03-xxxxx"

aws secretsmanager create-secret --name gst360/s3-bucket \
  --secret-string "gst360-uploads-${AWS_ACCOUNT_ID}"
```

### Step 5: Deploy ECS Services

See task definitions in `aws/ecs-task-definition-backend.json` and `aws/ecs-task-definition-frontend.json`.

Register and deploy:
```bash
# Register task definitions
aws ecs register-task-definition --cli-input-json file://aws/ecs-task-definition-backend.json
aws ecs register-task-definition --cli-input-json file://aws/ecs-task-definition-frontend.json

# Create services (use values from CloudFormation outputs)
aws ecs create-service \
  --cluster gst360-cluster \
  --service-name gst360-backend \
  --task-definition gst360-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx]}" \
  --load-balancers "targetGroupArn=arn:aws:...,containerName=gst360-backend,containerPort=8000"
```

## Local Development with Docker

For local testing with the same Docker setup:

```bash
# Create .env file with your API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access locally:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Environment Variables

### Backend
| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| ANTHROPIC_API_KEY | Anthropic API key for Claude | Yes |
| ANTHROPIC_MODEL | Model to use (default: claude-sonnet-4-20250514) | No |
| STORAGE_BACKEND | Storage type: local, s3, hybrid | No |
| AWS_S3_BUCKET | S3 bucket for uploads | If using S3 |
| AWS_REGION | AWS region | If using S3 |

### Frontend
| Variable | Description | Required |
|----------|-------------|----------|
| VITE_API_URL | Backend API URL | Yes (build-time) |

## Updating the Application

To deploy updates:

```bash
# Rebuild and push images
docker build -t gst360-backend -f backend/Dockerfile .
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/gst360-backend:latest

# Force new deployment
aws ecs update-service --cluster gst360-cluster --service gst360-backend --force-new-deployment
```

## Monitoring

### CloudWatch Logs
- Backend logs: `/ecs/gst360-backend`
- Frontend logs: `/ecs/gst360-frontend`

### Health Checks
- Backend: `GET /health`
- Frontend: `GET /`

## Cost Estimation (Monthly)

| Resource | Type | Estimated Cost |
|----------|------|----------------|
| ECS Fargate (Backend) | 0.5 vCPU, 1GB | ~$15-20 |
| ECS Fargate (Frontend) | 0.25 vCPU, 0.5GB | ~$8-10 |
| RDS PostgreSQL | db.t3.micro | ~$15-20 |
| ALB | Application Load Balancer | ~$16-20 |
| NAT Gateway | Per AZ | ~$32-40 |
| S3 | Storage + Requests | ~$1-5 |
| **Total** | | **~$90-120/month** |

## Cleanup

To delete all resources:

```bash
# Delete ECS services first
aws ecs update-service --cluster gst360-cluster --service gst360-backend --desired-count 0
aws ecs update-service --cluster gst360-cluster --service gst360-frontend --desired-count 0
aws ecs delete-service --cluster gst360-cluster --service gst360-backend
aws ecs delete-service --cluster gst360-cluster --service gst360-frontend

# Delete secrets
aws secretsmanager delete-secret --secret-id gst360/database-url --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id gst360/anthropic-api-key --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id gst360/s3-bucket --force-delete-without-recovery

# Delete CloudFormation stack (this will delete VPC, RDS, ALB, etc.)
aws cloudformation delete-stack --stack-name gst360-infrastructure

# Delete ECR images
aws ecr delete-repository --repository-name gst360-backend --force
aws ecr delete-repository --repository-name gst360-frontend --force
```

## Troubleshooting

### Services not starting
1. Check CloudWatch logs for error messages
2. Verify secrets are correctly set in Secrets Manager
3. Check security group rules allow traffic

### Database connection issues
1. Verify RDS is in AVAILABLE state
2. Check security group allows traffic from ECS tasks
3. Verify DATABASE_URL format is correct

### Frontend can't reach backend
1. Verify VITE_API_URL was set correctly during build
2. Check ALB listener rules are routing /api/* to backend
3. Verify backend health check is passing
