-- Migration to update all users to have emailVerified = true
-- This is required after disabling email verification feature

UPDATE "User" 
SET "emailVerified" = true 
WHERE "emailVerified" = false;

-- Verify the update
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN "emailVerified" = true THEN 1 END) as verified_users,
  COUNT(CASE WHEN "emailVerified" = false THEN 1 END) as unverified_users
FROM "User";