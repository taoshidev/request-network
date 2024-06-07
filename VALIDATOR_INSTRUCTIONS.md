# Request Network Validator Server Setup Instructions

## Table of Contents

1. [Introduction](#introduction)
2. [Technology Stack Overview](#technology-stack-overview)
3. [Setup Process](#setup-process)
4. [Registering as a Validator](#registering-as-a-validator)
5. [Output Server Connection](#output-server-connection)
6. [Deployment Workflow](#deployment-workflow)
7. [Payment Integration](#payment-integration)
8. [Configuring Stripe Payments](#stripe-payments)
9. [Sentry Error Tracking](#sentry-error-tracking)
10. [Example License](#example-license)

## Introduction

This comprehensive guide is designed for technical personnel responsible for setting up, configuring, and maintaining a Validator Server on the Request Network infrastructure. It covers the comprehensive lifecycle of a Validator Server, from initial setup to advanced operations and troubleshooting.

## Technology Stack Overview

The technology stack for Request Network Marketplace involves several modern and robust technologies optimized for high performance and reliability:

- **Backend Technologies**: Node.js with Express for building fast, scalable network applications.
- **Frontend Framework**: React with Next.js for improved SEO and optimized page loading by server-side rendering.
- **Database Systems**: PostgreSQL for its advanced features and excellent concurrency support without read locks.
- **Containerization**: Docker for creating, deploying, and running applications in isolated environments.
- **Cloud Infrastructure**: AWS services including ECS (Elastic Container Service) and Elastic Beanstalk for deployment and scaling.
- **Version Management Tools**: NVM to manage Node.js versions and PNPM for efficient package management.

## Setup Process

### Environment Configuration

Configure your environment to differentiate between development, staging and production settings:

- **Development Settings**: Test network and configure the API to interact with mock data.
- **Staging Settings**: Test network and configure the API to interact with mock data. Reserved for environments that are deployed to a live server, but not yet production-ready.
- **Production Settings**: Set up connections to Stripe Api for handling live data and transactions.

### Initial Configuration

1. **Fork the Repository**

   - Fork the repository here: [Request Network on GitHub](https://github.com/taoshidev/request-network)

2. **Database and API Configuration**

   - Configure the database and API settings:
     ```
     DATABASE_URL=postgres://user:pass@host:port/database
     NODE_ENV=development
     ```

3. **Docker Compose Configuration**

   - Review and configure services using `docker-compose.yml`.

4. **Additional Configuration**

   - Configure encryption keys (used by CryptoJS to encrypt keys and secrets at rest):
     - `ENCRYPTION_KEY=WANabc234=`
     - `IV_STRING=dxabcdeLAP333123abcLg==`
   - Set API and network configurations:
     - `VALIDATOR_NAME=Your Validator Name`
     - `API_PORT=8080`
     - `API_HOST=http://localhost:8080`
     - `API_PREFIX=/api/v1`
     - `REQUEST_NETWORK_UI_URL=http://rn-staging.taoshi.io` or
     - `REQUEST_NETWORK_UI_URL=http://request.taoshi.io` for production
   - Set Unkey verify URL:
     - `UNKEY_VERIFY_URL=https://api.unkey.dev/v1/keys.verifyKey`

### Configuring Environment Variables

```
VALIDATOR_NAME=
NODE_ENV=
API_PORT=
API_HOST=
API_PREFIX=
DATABASE_URL=
REQUEST_NETWORK_UI_URL=
VALIDATOR_OUTPUT_SERVER_API_URL=
TAOSHI_API_KEY=
TAOSHI_VALIDATOR_API_SECRET=
ENCRYPTION_KEY=
IV_STRING=
UNKEY_VERIFY_URL=
STRIPE_ENROLLMENT_SECRET=
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOKS_KEY=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

## Registering as a Validator

Complete the registration through the Request Network Marketplace UI:

1. Navigate to the Request Network Marketplace UI Validator Registration page:
   - [Request Network Marketplace Registration](https://request.taoshi.io)
2. Authenticate using OAuth, authorize Request Network Marketplace to access your information, and set up your Validator Server.
   - Click on **Dashboard**.
3. Authenticate using OAuth to ensure secure access.
4. Authorize Request Network Marketplace to access your information.
5. Choose the account type as **Validator**.
6. Enter your Validator Server's base Url, which represents the instance you will spin up:
   - Note: If the hosting details are not finalized, enter a placeholder and update it later.
   - This Url will be automatically updated when you spin up your Validator Server instance.

### API Keys and Endpoint Configuration

Upon completing the registration, you will receive an Api key and a secret, which are crucial for operating your Validator Server:

- **API Key**: `TAOSHI_API_KEY=api_abcdef`
- **Secret**: `TAOSHI_VALIDATOR_API_SECRET=abc123456`

These credentials allow you to authenticate incoming requests and manage interactions between your Validator Server and the Request Network Marketplace UI.

### Setup and Configuration

Request Network Validator Server acts as a proxy between the consumer Api and the Validator Output Server (OPS). To establish this connection:

1. Specify the OPS base URL in your `.env` file:
   - `VALIDATOR_OUTPUT_SERVER_API_URL=https://output-server-1:8080`
2. Data Flow:
   - **Consumer API Request**: Sends a request to a specified endpoint received during the subscription to Validator services.
   - **Header Key**: `x-taoshi-consumer-request-key`
   - **ReqNet Processing**: Receives and authenticates the consumer request, verifies ownership.
   - **ReqNet to OPS Request**: Sends a request to the OPS with a header key `x-taoshi-validator-request-key`.
   - **Communication Keys**: Uses `x-taoshi-request-key` for communication between Request Network Marketplace UI and Validator Server.

### Endpoint Creation

- A verified validator can register multiple endpoints, one per subnet, up to a total of 32 subnets (SN):
  - Example endpoints:
    - `/api/v1/user/:id`
    - `/api/v1/user/:id?min=1&max=50`
    - `/validator-checkpoint`

## Output Server Connection

Set up the Validator Output Server (OPS) connection:

- Configure the OPS base URL in your `.env` file:
  - VALIDATOR_OUTPUT_SERVER_API_URL=https://output-server-url:8080

## Deployment Workflow

1. **Local Deployment**

- Build and run your Docker container locally:
  ```
  docker compose build --no-cache
  docker compose up -d
  ```

2. **AWS Deployment**

- Deploy using AWS Elastic Beanstalk:
  ```
  eb init
  eb create
  eb open
  ```

### Deployment Workflow

#### General Deployment Information

The Validator Server can be deployed anywhere that supports Node.js, with or without Docker. At Taoshi, we deploy our own Validator Server on AWS ECS and Elastic Beanstalk. The project source code is set up with workflows for deployment to AWS ECS and/or AWS Elastic Beanstalk.

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

## Payment Integration

When currency type of "Fiat" is selected during registration, payments are are facilitated and managed through Stripe Integration.

## Stripe Payments

To enable Stripe payments you will need to create a Stripe account and store the credentials in your .env file.

1. Go to [stripe.com](https://stripe.com) to register and create credentials.
2. Complete registration to enable use account out of test mode and accept live payments.
3. Store the credentials in your env file.

```
    STRIPE_HOST=https://stripe.com <-- Needed to whitelist stripe website for webhooks.
    STRIPE_ENROLLMENT_SECRET=<random string to be used for jwt token verification>
    STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    STRIPE_WEBHOOKS_KEY=<Webhooks key required for payment status updates>
```

4. For Stipe subscriptions to be updated properly webhooks need to be set up. A webhook configuration will need to be set up on the Stripe website that points at "https://\<location of your api server\>/webhooks.

<br>
**Command to test and enable Strip Payments**

```
    stripe trigger payment_intent.succeeded --add payment_intent:metadata.activate=true
```

## Sentry Error Tracking

- Sentry error tracking can optionally be enabled by providing credentials. Got to [https://sentry.io/](https://sentry.io/) to configure.


```
    SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    SENTRY_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Example License
[License on Github](https://github.com/taoshidev/request-network/blob/staging/EXAMPLE_TOS.md)
