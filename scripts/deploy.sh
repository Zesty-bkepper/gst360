#!/bin/bash
set -e

# GST360 AWS Deployment Script
# This script deploys the GST360 application to AWS ECS Fargate

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-gst360}"
STACK_NAME="${ENVIRONMENT}-infrastructure"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  GST360 AWS Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed. Please install it first.${NC}"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi

    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}AWS Account: ${AWS_ACCOUNT_ID}${NC}"
    echo -e "${GREEN}AWS Region: ${AWS_REGION}${NC}"
}

# Deploy CloudFormation infrastructure
deploy_infrastructure() {
    echo -e "\n${YELLOW}Deploying infrastructure with CloudFormation...${NC}"

    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${YELLOW}Stack exists, updating...${NC}"
        aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://aws/cloudformation-infrastructure.yaml \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="$ENVIRONMENT" \
                ParameterKey=DBUsername,ParameterValue="${DB_USERNAME:-gst360admin}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
            --capabilities CAPABILITY_IAM \
            --region "$AWS_REGION" || true
    else
        echo -e "${YELLOW}Creating new stack...${NC}"
        aws cloudformation create-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://aws/cloudformation-infrastructure.yaml \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="$ENVIRONMENT" \
                ParameterKey=DBUsername,ParameterValue="${DB_USERNAME:-gst360admin}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
            --capabilities CAPABILITY_IAM \
            --region "$AWS_REGION"
    fi

    echo -e "${YELLOW}Waiting for stack to complete...${NC}"
    aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$AWS_REGION" 2>/dev/null || \
    aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" --region "$AWS_REGION" 2>/dev/null || true

    echo -e "${GREEN}Infrastructure deployed successfully!${NC}"
}

# Build and push Docker images
build_and_push_images() {
    echo -e "\n${YELLOW}Building and pushing Docker images...${NC}"

    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    # Get ALB DNS for frontend build
    ALB_DNS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" --output text)

    # Build and push backend
    echo -e "${YELLOW}Building backend image...${NC}"
    docker build -t gst360-backend -f backend/Dockerfile .
    docker tag gst360-backend:latest "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/gst360-backend:latest"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/gst360-backend:latest"

    # Build and push frontend
    echo -e "${YELLOW}Building frontend image...${NC}"
    docker build -t gst360-frontend \
        --build-arg VITE_API_URL="http://${ALB_DNS}" \
        -f frontend/Dockerfile frontend/
    docker tag gst360-frontend:latest "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/gst360-frontend:latest"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/gst360-frontend:latest"

    echo -e "${GREEN}Docker images pushed successfully!${NC}"
}

# Store secrets in AWS Secrets Manager
store_secrets() {
    echo -e "\n${YELLOW}Storing secrets in AWS Secrets Manager...${NC}"

    # Get database endpoint
    DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)

    DATABASE_URL="postgresql://${DB_USERNAME:-gst360admin}:${DB_PASSWORD}@${DB_ENDPOINT}:5432/gst360"

    # Get S3 bucket name
    S3_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='UploadsBucketName'].OutputValue" --output text)

    # Create/update secrets
    for secret_name in "gst360/database-url" "gst360/anthropic-api-key" "gst360/s3-bucket"; do
        aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null || \
        aws secretsmanager create-secret --name "$secret_name" --region "$AWS_REGION" --secret-string "placeholder"
    done

    aws secretsmanager put-secret-value --secret-id "gst360/database-url" --secret-string "$DATABASE_URL" --region "$AWS_REGION"
    aws secretsmanager put-secret-value --secret-id "gst360/anthropic-api-key" --secret-string "${ANTHROPIC_API_KEY}" --region "$AWS_REGION"
    aws secretsmanager put-secret-value --secret-id "gst360/s3-bucket" --secret-string "$S3_BUCKET" --region "$AWS_REGION"

    echo -e "${GREEN}Secrets stored successfully!${NC}"
}

# Create ECS Task Role
create_task_role() {
    echo -e "\n${YELLOW}Creating ECS Task Role...${NC}"

    # Create trust policy
    cat > /tmp/trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

    # Create role if it doesn't exist
    aws iam get-role --role-name gst360-task-role &> /dev/null || \
    aws iam create-role --role-name gst360-task-role --assume-role-policy-document file:///tmp/trust-policy.json

    # Attach S3 policy
    cat > /tmp/s3-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::${ENVIRONMENT}-uploads-${AWS_ACCOUNT_ID}",
                "arn:aws:s3:::${ENVIRONMENT}-uploads-${AWS_ACCOUNT_ID}/*"
            ]
        }
    ]
}
EOF

    aws iam put-role-policy --role-name gst360-task-role --policy-name s3-access --policy-document file:///tmp/s3-policy.json

    echo -e "${GREEN}Task role created successfully!${NC}"
}

# Deploy ECS Services
deploy_services() {
    echo -e "\n${YELLOW}Deploying ECS services...${NC}"

    # Get outputs from CloudFormation
    CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ECSClusterName'].OutputValue" --output text)
    PRIVATE_SUBNETS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnets'].OutputValue" --output text)
    ECS_SG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ECSSecurityGroup'].OutputValue" --output text)
    BACKEND_TG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='BackendTargetGroupArn'].OutputValue" --output text)
    FRONTEND_TG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='FrontendTargetGroupArn'].OutputValue" --output text)

    # Process task definitions (replace variables)
    sed -e "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" \
        -e "s/\${AWS_REGION}/${AWS_REGION}/g" \
        aws/ecs-task-definition-backend.json > /tmp/backend-task.json

    sed -e "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" \
        -e "s/\${AWS_REGION}/${AWS_REGION}/g" \
        aws/ecs-task-definition-frontend.json > /tmp/frontend-task.json

    # Register task definitions
    aws ecs register-task-definition --cli-input-json file:///tmp/backend-task.json --region "$AWS_REGION"
    aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task.json --region "$AWS_REGION"

    # Create or update backend service
    if aws ecs describe-services --cluster "$CLUSTER_NAME" --services gst360-backend --region "$AWS_REGION" \
        --query "services[?status=='ACTIVE']" --output text | grep -q gst360-backend; then
        echo -e "${YELLOW}Updating backend service...${NC}"
        aws ecs update-service --cluster "$CLUSTER_NAME" --service gst360-backend \
            --task-definition gst360-backend --force-new-deployment --region "$AWS_REGION"
    else
        echo -e "${YELLOW}Creating backend service...${NC}"
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name gst360-backend \
            --task-definition gst360-backend \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNETS}],securityGroups=[${ECS_SG}],assignPublicIp=DISABLED}" \
            --load-balancers "targetGroupArn=${BACKEND_TG},containerName=gst360-backend,containerPort=8000" \
            --region "$AWS_REGION"
    fi

    # Create or update frontend service
    if aws ecs describe-services --cluster "$CLUSTER_NAME" --services gst360-frontend --region "$AWS_REGION" \
        --query "services[?status=='ACTIVE']" --output text | grep -q gst360-frontend; then
        echo -e "${YELLOW}Updating frontend service...${NC}"
        aws ecs update-service --cluster "$CLUSTER_NAME" --service gst360-frontend \
            --task-definition gst360-frontend --force-new-deployment --region "$AWS_REGION"
    else
        echo -e "${YELLOW}Creating frontend service...${NC}"
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name gst360-frontend \
            --task-definition gst360-frontend \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNETS}],securityGroups=[${ECS_SG}],assignPublicIp=DISABLED}" \
            --load-balancers "targetGroupArn=${FRONTEND_TG},containerName=gst360-frontend,containerPort=80" \
            --region "$AWS_REGION"
    fi

    echo -e "${GREEN}ECS services deployed successfully!${NC}"
}

# Print deployment info
print_info() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"

    ALB_DNS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" --output text)

    echo -e "\n${GREEN}Application URL: http://${ALB_DNS}${NC}"
    echo -e "${GREEN}API URL: http://${ALB_DNS}/api${NC}"
    echo -e "${GREEN}API Docs: http://${ALB_DNS}/docs${NC}"
    echo -e "\n${YELLOW}Note: It may take a few minutes for the services to become healthy.${NC}"
}

# Main execution
main() {
    # Check for required environment variables
    if [ -z "$DB_PASSWORD" ]; then
        echo -e "${RED}Error: DB_PASSWORD environment variable is required${NC}"
        echo "Usage: DB_PASSWORD=your_password ANTHROPIC_API_KEY=your_key ./scripts/deploy.sh"
        exit 1
    fi

    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo -e "${RED}Error: ANTHROPIC_API_KEY environment variable is required${NC}"
        echo "Usage: DB_PASSWORD=your_password ANTHROPIC_API_KEY=your_key ./scripts/deploy.sh"
        exit 1
    fi

    check_prerequisites
    deploy_infrastructure
    create_task_role
    store_secrets
    build_and_push_images
    deploy_services
    print_info
}

# Run main function
main "$@"
