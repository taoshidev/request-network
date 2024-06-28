# Validator Setup Guide for Request Network

Welcome to the Request Network Validator Setup Guide. This guide is tailored specifically for validators who play a crucial role in ensuring the integrity and availability of data on the Request Network. It includes detailed instructions on setting up and running your Validator Server using various technologies.

## Table of Contents

1. [Introduction](#introduction)
2. [Bittensor Validator Registration](#bittensor-validator-registration)
3. [Enable Data Requests](#enable-data-requests)
4. [RN Configuration Details](#rn-configuration-details)
5. [Deployment Options](#deployment-options)
6. [Maintaining and Monitoring](#maintaining-and-monitoring)
7. [API Key Management](#api-key-management)
8. [Registration as a Validator](#registration-as-a-validator)
9. [Troubleshooting](#troubleshooting)

## Introduction

As a validator on the Request Network, you contribute to a robust data marketplace. This guide will help you set up a Validator Server, from initial setup and local server operations to deployment and maintenance on various platforms.

## Bittensor Validator Registration

Register as a validator on Bittensor:

- Generate keys and register:

1. **Create Hot and Cold Keys & Subnet Registration**:

   - Navigate to the the Bittensor documentation page at https://docs.bittensor.com/getting-started/installation and install the Bittensor CLI. Once you have access to the cli, run:
     ```
     btcli wallet new_coldkey --wallet.name my-validator
     btcli wallet new_hotkey --wallet.name my-validator --wallet.hotkey default
     btcli wallet faucet --wallet.name my-validator --subtensor.network test
     btcli wallet list
     btcli subnet register --wallet.name my-validator --wallet.hotkey default --subtensor.network test
     ```

- You'll be prompted to:
  - Enter password to unlock key.
  - Enter netUid (the Subnet to register onto).

For detailed instructions, refer to the [Bittensor Documentation](https://docs.bittensor.com/).

## Enable Data Requests

Running a data server is an essential part of operating as a validator. It allows the data to be served to paying customers.
For example, with SN8, we provide the following Flask example code to serve outputs. This code runs locally on the same validator that is running SN8.
The exposed endpoints can be input into the Request Network UI registration to be used by data purchasers.

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/taoshidev/serve-outputs-ptn
   cd serve-outputs-ptn
    ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask App**:
   ```bash
   python serve.py
   ```
This simple Flask server will handle requests on your validator. You may also choose to run this locally to develop and test your endpoints. 

## RN Configuration Details

1. **Fork the RN Repository**

   - Fork the repository here: [Request Network on GitHub](https://github.com/taoshidev/request-network)
   ```bash
   git clone https://github.com/taoshidev/request-network.git
   cd request-network
   ```

2. **Docker Compose Configuration**

   - Review and configure services using `docker-compose.yml`.
   - This project uses Docker to manage its services. To start the containers, run:

   ```bash
   docker-compose build && docker-compose up -d
   ```

   This command will start all the required services in the background.


3. **Database and API Configuration**

   Configure the database and API settings:
     ```
     DATABASE_URL=postgres://user:pass@host:port/database
     NODE_ENV=development
     ```
     
    With the containers running, you need to set up the database schema. Run the following command to execute migrations:

   ```bash
   pnpm db:push
   # or
   yarn db:push
   ```

   When spinning up the project, the server will run db:push on for you. When there's database schema change run:

   ```bash
   pnpm db:generate
   pnpm db:push
   # or
   yarn db:generate
   pnpm db:push
   ```

5. **Additional Configuration**

   - Configure encryption keys (used by CryptoJS to encrypt keys and secrets at rest):
     - `ENCRYPTION_KEY=WANabc234=`
     - `IV_STRING=dxabcdeLAP333123abcLg==`
   - Set API and network configurations:
     - `VALIDATOR_NAME=Your Validator Name`
     - `API_PORT=8080`
     - `API_HOST=http://localhost:8080`
     - `API_PREFIX=/api/v1`
     - `REQUEST_NETWORK_UI_URL=http://request.taoshi.io`
   - Set Unkey verify URL:
     - `UNKEY_VERIFY_URL=https://api.unkey.dev/v1/keys.verifyKey`


6. **Environment Variables**

   Copy the `.env.example` file to create your own `.env` file. Adjust the variables to match your environment setup:

   ```bash
   cp .env.example .env
   ```

   Make sure to replace the placeholders in the `.env` file with your actual data.

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
PAYMENT_ENROLLMENT_SECRET=
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOKS_KEY=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
   ```

ReqNet acts as a proxy between the consumer API and the Validator Output Server (OPS). To establish this connection:

   1. Specify the OPS base URL in your `.env` file:
      - `VALIDATOR_OUTPUT_SERVER_API_URL=https://output-server-1:8080`
   2. Data Flow:
      - **Consumer API Request**: Sends a request to a specified endpoint received during the subscription to Validator services.
      - **Header Key**: `x-taoshi-consumer-request-key`
      - **ReqNet Processing**: Receives and authenticates the consumer request, verifies ownership.
      - **ReqNet to OPS Request**: Sends a request to the OPS with a header key `x-taoshi-validator-request-key`.
      - **Communication Keys**: Uses `x-taoshi-request-key` for communication between ReqNet UI and Validator Node.

This configuration ensures that your Validator Node can securely and efficiently handle requests, and managing data flow through designated endpoints.
 

7.**Start the Application**

Once the database is set up, you can start the application server:

   ```bash
   pnpm start
   # or
   yarn start
   ```

   To run the server on development mode:

   ```bash
   pnpm dev
   # or
   yarn dev
   ```

   Running the server on development mode will enable live reload through nodemon. Any code changes you made in the src directory will be reactive (will re-transpile, and made available)

   This command will start the server, making the application available at `http://localhost:3000` by default (or another port, depending on your `.env` configuration).

   To create a production build, run:

   ```bash
   pnpm build
   # or
   yarn build
   ```

   This command compiles TypeScript to JavaScript, optimizing for production environments.



## Deployment Options

Validators have multiple options for deploying their node, including on local machines or using cloud services like AWS:
We suggest using AWS Elastic Beanstalk for a more scalable deployment suitable for production environments.

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
  
The Validator Node can be deployed anywhere that supports Node.js, with or without Docker. At Taoshi, we deploy our own Validator Node in AWS ECS and Elastic Beanstalk. The project source code is set up with workflows for deployment to AWS ECS and/or AWS Elastic Beanstalk.

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


## Maintaining and Monitoring

Regular maintenance and monitoring are vital to ensure the seamless operation of your Validator Node. Monitor logs and performance, and update your system as needed to handle any potential issues.

## Registration as a Validator

To begin, validators must register through the Taoshi UI:

1. Navigate to [ReqNet Validator Registration](https://request.taoshi.io).
2. Authenticate using OAuth and authorize ReqNet to access your information.
3. Choose the account type as **Validator** and enter your node's base URL. This URL will be used when you spin up your Validator Node.
4. Any requested information regarding endpoints and wallets can be determined by following the above steps

- A verified validator can register multiple endpoints, one per subnet, up to a total of 32 subnets (SN):
  - Example endpoints:
    - `/api/v1/user/:id`
    - `/api/v1/user/:id?min=1&max=50`

- Configure the OPS base URL in your `.env` file:
  - VALIDATOR_OUTPUT_SERVER_API_URL=https://output-server-url:8080

## API Key Management

Upon registration, you will receive an API key and a secret:

API Key: Manage this key securely as it is crucial for authenticating requests to your Validator Node.
Secret: Store this securely to authenticate outgoing requests from your server.

## Troubleshooting

Encountering issues is common; here are a few tips:

Ensure your API keys are updated and correctly configured in your environment variables.
Check that your Docker and Flask servers are up and running without errors.
Verify your Polkadot wallet is correctly configured and linked.
Thank you for contributing to the Request Network as a validator. Your efforts help maintain a secure, reliable, and efficient marketplace for data transactions.