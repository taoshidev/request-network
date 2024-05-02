# Request Network Validator Setup Instructions

## Table of Contents

1. [Introduction](#introduction)
2. [Technology Stack Overview](#technology-stack-overview)
3. [Setup Process](#setup-process)
4. [Uphold API Integration](#uphold-api-integration)
5. [Registering as a Validator](#registering-as-a-validator)
6. [Output Server Connection](#output-server-connection)
7. [Deployment Workflow](#deployment-workflow)
8. [Escrow Wallet and Payment Integration](#escrow-wallet-and-payment-integration)
9. [Maintenance and Monitoring](#maintenance-and-monitoring)
10. [Bittensor Validator Registration](#bittensor-validator-registration)

## Introduction

This comprehensive guide is designed for technical personnel responsible for setting up, configuring, and maintaining a Validator node on the Request Network infrastructure. It covers the comprehensive lifecycle of a Validator node, from initial setup to advanced operations and troubleshooting.

## Technology Stack Overview

The technology stack for ReqNet involves several modern and robust technologies optimized for high performance and reliability:

- **Backend Technologies**: Node.js with Express for building fast, scalable network applications.
- **Frontend Framework**: React with Next.js for improved SEO and optimized page loading by server-side rendering.
- **Database Systems**: PostgreSQL for its advanced features and excellent concurrency support without read locks.
- **Containerization**: Docker for creating, deploying, and running applications in isolated environments.
- **Cloud Infrastructure**: AWS services including ECS (Elastic Container Service) and Elastic Beanstalk for deployment and scaling.
- **Version Management Tools**: NVM to manage Node.js versions and PNPM for efficient package management.
- **Blockchain Integration**: Infura API for interfacing with the Ethereum network and Uphold API for managing crypto transactions.

## Setup Process (Also see README)

### Environment Configuration

Configure your environment to differentiate between development and production settings:

- **Development Settings**: Connect to the Ethereum 'Sepolia' test network and configure the API to interact with mock data.
- **Production Settings**: Set up connections to the Ethereum 'mainnet' for handling live data and transactions.

## Setup Instructions

1. **Fork the Repository**

   - Fork the repository here: [Request Network on GitHub](https://github.com/taoshidev/request-network)

2. **Get Uphold Test Keys**

   - Visit: [Uphold Developer](https://uphold.com/get-started/developer?modal=sandbox)
   - Login to the sandbox:
     - Create an account and log in.
     - When logging in, you will be prompted to enter a 6-digit number.
     - **IMPORTANT**: Enter all zeros: `000000`.
     - On the left side, look for the three dots.
     - Navigate to "Developer applications".
     - Click the plus sign to register your application and receive your key and secret.
   - Set your Uphold API keys:
     - `UPHOLD_CLIENT_ID=1234356abcd`
     - `UPHOLD_CLIENT_SECRET=98765abcd`

3. **Create an Infura Project**

   - Create a project here: [Infura](https://app.infura.io)
   - Set the Infura Project ID:
     - `INFURA_PROJECT_ID=7654321abcd`

4. **Setup Database Connection String and Variables**

   - Configure the following database variables:
     - `DATABASE_URL=postgres://user:pass@host:port/database`
     - `POSTGRES_DB=postgres`
     - `POSTGRES_PORT=5432`
     - `POSTGRES_HOST=db`
     - `POSTGRES_USER=postgres`
     - `POSTGRES_PASSWORD=postgres`
   - Note:
     - Variables are used in the Docker container.
     - Connection string is used by the application.

5. **Additional Configuration**

   - Set environment variables:
     - `NODE_ENV=development`
   - Configure encryption keys (used by CryptoJS to encrypt keys and secrets at rest):
     - `ENCRYPTION_KEY=WANabc234=`
     - `IV_STRING=dxabcdeLAP333123abcLg==`
   - Set API and network configurations:
     - `API_PORT=8080`
     - `API_HOST=http://localhost:8080`
     - `API_PREFIX=/api/v1`
     - `REQUEST_NETWORK_UI_URL=http://rn-dev.taoshi.io`
   - Set Unkey verify URL:
     - `UNKEY_VERIFY_URL=https://api.unkey.dev/v1/keys.verifyKey`

6. **Review Docker Compose Setup**
   - See the `docker-compose.yml` for how the services are configured and interconnected.

### Configuring Environment Variables

```
API_PORT=
API_HOST=
API_PREFIX=
REQUEST_NETWORK_UI_URL=
VALIDATOR_OUTPUT_SERVER_API_URL=
UNKEY_VERIFY_URL=
TAOSHI_API_KEY=
TAOSHI_VALIDATOR_API_SECRET=
UPHOLD_CLIENT_ID=
UPHOLD_CLIENT_SECRET=
ENCRYPTION_KEY=
IV_STRING=
INFURA_PROJECT_ID=
NODE_ENV=
POSTGRES_DB=
POSTGRES_PORT=
POSTGRES_HOST=
POSTGRES_USER=
POSTGRES_PASSWORD=
DATABASE_URL=
```

## Uphold API Integration

ReqNet utilizes the Uphold API to manage cryptocurrency conversions and transactions.

### API Endpoints

- **Development**: During the development phase, ReqNet will use the Uphold sandbox API endpoint to simulate transactions:
  - Sandbox Endpoint: [https://api-sandbox.uphold.com](https://api-sandbox.uphold.com)
- **Production**: In production, the live API endpoint is used for actual transactions:
  - Live Endpoint: [https://api.uphold.com](https://api.uphold.com)

## Registering as a Validator

Registering as a validator on ReqNet is a straightforward process facilitated by the ReqNet UI.

### Registration Steps

1. Navigate to the ReqNet registration page:
   - [ReqNet Validator Registration](https://rn-dev.taoshi.io)
2. Click on **Dashboard**.
3. Authenticate using OAuth to ensure secure access.
4. Authorize ReqNet to access your information.
5. Choose the account type as **Validator**.
6. Enter your Validator Node's base URL, which represents the instance you will spin up:
   - Note: If the hosting details are not finalized, enter a placeholder and update it later.
   - This URL will be automatically updated when you spin up your Validator Node instance.

### API Keys and Endpoint Configuration

Upon completing the registration, you will receive an API key and a secret, which are crucial for operating your Validator Node:

- **API Key**: `TAOSHI_API_KEY=api_abcdef`
- **Secret**: `TAOSHI_VALIDATOR_API_SECRET=abc123456`

These credentials allow you to authenticate incoming requests and manage interactions between your Validator Node and the ReqNet UI.

### Endpoint Creation

- A verified validator can register multiple endpoints, one per subnet, up to a total of 32 subnets (SN):
  - Example endpoints:
    - `/api/v1/user/:id`
    - `/api/v1/user/:id?min=1&max=50`

## Output Server Connection

### Setup and Configuration

ReqNet acts as a proxy between the consumer API and the Validator Output Server (OPS). To establish this connection:

1. Specify the OPS base URL in your `.env` file:
   - `VALIDATOR_OUTPUT_SERVER_API_URL=https://output-server-1:8080`
2. Data Flow:
   - **Consumer API Request**: Sends a request to a specified endpoint received during the subscription to Validator services.
   - **Header Key**: `x-taoshi-consumer-request-key`
   - **ReqNet Processing**: Receives and authenticates the consumer request, verifies ownership.
   - **ReqNet to OPS Request**: Sends a request to the OPS with a header key `x-taoshi-validator-request-key`.
   - **Communication Keys**: Uses `x-taoshi-request-key` for communication between ReqNet UI and Validator Node.

This configuration ensures that your Validator Node can securely and efficiently handle requests, performing necessary conversions and transactions via the Uphold API, and managing data flow through designated endpoints.

### Validator Node Configuration

#### Detailed Docker Setup

#### Spin up local instance

```
docker compose build --no-cache
```

```
docker compose up -d
```

#### Build for Deployment

```
docker build . -t request-network:v1.0.0
```

Test the build

```
docker run -p 8080:8080 --env-file .env.staging -d request-network:v1.0.0
```

Stop the app

```
docker stop 18c8b3d232fe
```

### Deployment Workflow

#### General Deployment Information

The Validator Node can be deployed anywhere that supports Node.js, with or without Docker. At Taoshi, we deploy our own Validator Node in AWS ECS and Elastic Beanstalk. The project source code is set up with workflows for deployment to AWS ECS and/or AWS Elastic Beanstalk.

#### Deploying with AWS Elastic Beanstalk CLI (EB CLI)

##### Installation and Configuration

1. **Install the EB CLI**:

   - Ensure that the EB CLI is installed on your machine. If it's not, you can install it using pip:
     ```bash
     pip install awsebcli --upgrade --user
     ```
   - For detailed installation instructions, visit [AWS EB CLI Installation](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install-advanced.html).

2. **Configure AWS Credentials**:
   - Before using the EB CLI, configure your AWS credentials. This setup is necessary to authenticate and communicate with AWS services:
     ```bash
     aws configure
     ```
   - You will need to provide:
     - AWS Access Key ID
     - AWS Secret Access Key
     - Default region name
     - Default output format (optional)

##### Initializing and Deploying the Application

3. **Initialize Your Application**:

   - Navigate to the root directory of your application where the application's code is located and run:
     ```bash
     eb init
     ```
   - You'll be prompted to:
     - Select the AWS region.
     - Provide the name for your application.
     - Choose the platform (e.g., Node.js, Python, Java, etc.).
     - Decide whether to use CodeCommit.
     - Set up SSH for instances if needed.

4. **Create an Environment and Deploy**:

   - Once your application is initialized, create an Elastic Beanstalk environment and deploy your application:
     ```bash
     eb create
     ```
   - During this process, you will:
     - Provide an environment name.
     - Optionally configure more detailed settings like instance type, scaling options, etc.
   - The `eb create` command will handle the provisioning of AWS resources (like EC2, RDS, etc.) and deploy your application.

5. **Open Your Application**:

   - After the environment is created and your application is deployed, you can open it in a web browser:
     ```bash
     eb open
     ```
   - This command will automatically open the URL where your application is hosted.

6. **Update Your Application**:
   - To update your application after making changes to the code, use:
     ```bash
     eb deploy <environment> --profile <profile>
     e.g eb deploy staging --profile taoshi
     ```
   - This command deploys the latest version of your application to the Elastic Beanstalk environment.

Once everything is setup, with EB, run:

```
pnpm deploy:staging
```

Which should deploy your application to AWS EB under the account that's tied the configured profile.

## Escrow Wallet and Payment Integration

### Escrow Wallet Creation and Management

1. **Escrow Wallet Setup**:

   - Upon a successful consumer subscription, the Validator Node application automatically creates an Escrow Wallet. This wallet is essential for handling transactions securely.
   - The public key of the escrow wallet is shared with the consumer. This allows the consumer to make payments in the method of their choosing, typically in stablecoins such as USDC or USDT.

2. **Database Integration**:
   - The details of the Escrow Wallet, including the public key and other relevant metadata, are securely stored in the database associated with the Validator Node. This ensures that the wallet can be retrieved and managed efficiently.

### Payment Processing via Uphold API

1. **Initial Deposit and Account Activation**:

   - When the consumer makes their initial deposit, the Validator Node uses the Uphold API to convert the deposited stable coins (USDC/USDT) into TAO. This conversion is crucial for activating the consumer's account.
     - Note: USDT not supported on as of the current release
   - If an account becomes inactive due to non-payment, it can be reactivated upon the next deposit, triggering a similar conversion process.

2. **Monthly Fund Checks and Conversions**:

   - Starting on the first day of each month, the Validator Node initiates a check on the escrow wallet to verify if sufficient funds are available.
   - The stable coins are then sent to Uphold, where they are converted into TAO. This process ensures that the funds are ready for withdrawal.

3. **Withdrawal to Designated Wallet**:
   - After conversion, the TAO is withdrawn back into the validator's hotkey.

## Bittensor Validator Registration


1. **Create Hot and Cold Keys & Subnet Registration**:

   - Navigate to the the Bittensor documentation page at https://docs.bittensor.com/getting-started/installation and install the Bittensor CLI. Once you have access to the cli,  run:
     ```bash
     btcli wallet new_coldkey --wallet.name my-validator

     btcli wallet new_hotkey --wallet.name my-validator --wallet.hotkey default

     btcli wallet faucet --wallet.name my-validator --subtensor.network test

     btcli wallet list

     btcli subnet register --wallet.name my-validator --wallet.hotkey default --subtensor.network test
     ```
   - You'll be prompted to:
     - Enter password to unlock key.
     - Enter netUid (the Subnet to register onto).