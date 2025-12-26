-- Gate1 System - Database Initialization Script
-- This script runs automatically when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges (the database and user are created by docker-compose environment variables)
-- This script runs after the database is created

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Gate1 System database initialized successfully at %', NOW();
END $$;
