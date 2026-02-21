-- HelioScope AI — Database Setup Script
-- Run as: sudo -u postgres psql -f setup_db.sql

-- Create role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'helioscope') THEN
    CREATE ROLE helioscope WITH LOGIN PASSWORD 'Heli0$cope@i';
  ELSE
    ALTER ROLE helioscope WITH PASSWORD 'Heli0$cope@i';
  END IF;
END $$;

-- Create database
SELECT 'CREATE DATABASE helioscope OWNER helioscope'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'helioscope') \gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE helioscope TO helioscope;
