# Request Network Validator Setup Instructions

## Table of Contents

1. [Introduction](#introduction)
2. [Technology Stack Overview](#technology-stack-overview)
3. [Setup Process](#setup-process)
4. [Uphold API Integration](#uphold-api-integration)
5. [Registering as a Validator](#registering-as-a-validator)
6. [Output Server Connection](#output-server-connection)
7. [Deployment Workflow](#deployment-workflow)
8. [Payment Integration](#payment-integration)
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

## Setup Process

### Environment Configuration

Configure your environment to differentiate between development and production settings:

- **Development Settings**: Connect to the Ethereum 'Sepolia' test network and configure the API to interact with mock data.
- **Staging Settings**: Connect to the Ethereum 'Sepolia' test network and configure the API to interact with mock data. Reserved for environments that are deployed to a live server, but not yet production-ready.
- **Production Settings**: Set up connections to the Ethereum 'mainnet' for handling live data and transactions.

### Initial Configuration

1. **Fork the Repository**

   - Fork the repository here: [Request Network on GitHub](https://github.com/taoshidev/request-network)

2. **Set Up Infura Project**

   - Create a project on [Infura](https://app.infura.io)
   - Set the Infura Project ID:
     ```
     INFURA_PROJECT_ID=your_infura_project_id
     ```

3. **Database and API Configuration**

   - Configure the database and API settings:
     ```
     DATABASE_URL=postgres://user:pass@host:port/database
     NODE_ENV=development
     ```

4. **Docker Compose Configuration**
   - Review and configure services using `docker-compose.yml`.

## Registering as a Validator

Complete the registration through the ReqNet UI:

1. Navigate to the ReqNet Validator Registration page:
   - [ReqNet Validator Registration](https://rn-dev.taoshi.io)
2. Authenticate using OAuth, authorize ReqNet to access your information, and set up your Validator Node.

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

## Payment Integration

Ensure consumer deposits are recorded and manage account activations based on payment status. Handle monthly fund checks and conversions through Uphold API.

## Bittensor Validator Registration

Register as a validator on Bittensor:

- Generate keys and register:

```
btcli wallet new_coldkey --wallet.name my-validator
btcli wallet new_hotkey --wallet.name my-validator
btcli subnet register --wallet.name my-validator
```

For detailed instructions, refer to the [Bittensor Documentation](https://docs.bittensor.com/).
