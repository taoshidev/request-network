#!/bin/bash
echo "Running migrations..."
pnpm db:push
echo "Migrations completed."