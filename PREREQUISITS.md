Prerequisites
Before you get started, make sure you have the following installed on your system:

Node.js (version 19.x or higher)
npm (version 8.x or higher) or Yarn (version 1.22.x or higher)
Docker Desktop 4.25.2 (129061). (for running services in containers)
Git (for version control)
NVM v0.38.0

# Project Setup Guide

Welcome to the Project Setup Guide! This document provides you with all the necessary information to get this project up and running on your machine. Whether you're looking to contribute or just want to explore the functionalities, you're in the right place.

## Prerequisites

Before you get started, make sure you have the following installed on your system:

- Node.js (version 19.x or higher)
- npm (version 8.x or higher) or Yarn (version 1.22.x or higher)
- Docker Desktop 4.25.2 (129061). (for running services in containers)
- Git (for version control)
- NVM v0.38.0

## Installation Steps

1. **Fork and clone the Repository**

   Start by forking and then cloning the project repository to your local machine:

   ```bash
   git clone https://github.com/taoshidev/request-network.git
   cd request-network
   ```

2. **Install Dependencies**

   Use npm/pnpm or Yarn to install the project dependencies:

   ```bash
   # Using pnpm
   pnpm install

   # Using Yarn
   yarn install
   ```

3. **Environment Configuration**

   Copy the `.env.example` file to create your own `.env` file. Adjust the variables to match your environment setup:

   ```bash
   cp .env.example .env
   ```

   Make sure to replace the placeholders in the `.env` file with your actual data.

4. **Docker Containers**

   This project uses Docker to manage its services. To start the containers, run:

   ```bash
   docker-compose build && docker-compose up -d
   ```

   This command will start all the required services in the background.

5. **Database Setup**

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

6. **Start the Application**

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

## Development Workflow

- **Running the Development Server**

  For development, you might want to use the development server with hot-reload functionality:

  ```bash
  pnpm dev
  # or
  yarn dev
  ```

- **Running Tests**

  Execute the test suite to ensure your changes haven't broken existing functionality:

  ```bash
  pnpm test
  # or
  yarn test
  ```

- **Building for Production**

  To create a production build, run:

  ```bash
  pnpm build
  # or
  yarn build
  ```

  This command compiles TypeScript to JavaScript, optimizing for production environments.

## Contributing

We welcome contributions to this project! Please refer to the CONTRIBUTING.md file for detailed guidelines on how to contribute.
