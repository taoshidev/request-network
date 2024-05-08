#!/bin/bash

# Check for migration flag
if [ "$MIGRATE" == "true" ]; then
  echo "Running migrations..."
  pnpm db:migrate
  echo "Migrations completed."
fi

# Start your application
pnpm start
