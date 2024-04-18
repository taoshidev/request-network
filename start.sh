#!/bin/bash

# Check for migration flag
if [ "$MIGRATE" == "true" ]; then
  echo "Running migrations..."
  pnpm db:push
  echo "Migrations completed."
fi

# Start your application
pnpm start
