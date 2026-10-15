-- Database tambahan dev: shadow (migrate diff) + tes (vitest).
-- Nama database bukan secret, aman di repo. Idempoten (\gexec).
SELECT 'CREATE DATABASE "study_timer_shadow"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'study_timer_shadow')\gexec
SELECT 'CREATE DATABASE "study_timer_test"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'study_timer_test')\gexec
