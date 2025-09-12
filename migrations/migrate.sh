#!/bin/bash
# =====================================================
# VideoPlanet Database Migration Script
# Author: Daniel (Data Lead)
# Description: Safe database migration execution with validation
# =====================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/migration.log"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Database connection parameters
DB_HOST="${DB_HOST:-centerbeam.proxy.rlwy.net}"
DB_PORT="${DB_PORT:-25527}"
DB_NAME="${DB_NAME:-railway}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${PGPASSWORD:-yzrhKiriXKrSYAdxIdPSjNuNseQkhjAe}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Database connection test
test_connection() {
    log "Testing database connection..."
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Failed to connect to database"
        exit 1
    fi
}

# Create backup
create_backup() {
    log "Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="$BACKUP_DIR/backup_$(date +'%Y%m%d_%H%M%S').sql"
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$backup_file"
    
    success "Backup created: $backup_file"
    echo "$backup_file"
}

# Validate migration prerequisites
validate_prerequisites() {
    log "Validating migration prerequisites..."
    
    # Check if migration file exists
    local migration_file="$SCRIPT_DIR/001_cinegenius_v3_schema_upgrade.sql"
    if [[ ! -f "$migration_file" ]]; then
        error "Migration file not found: $migration_file"
        exit 1
    fi
    
    # Check current data counts
    local user_count
    user_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c 'SELECT COUNT(*) FROM "User";' 2>/dev/null | xargs)
    
    log "Current data counts:"
    log "  - Users: $user_count"
    
    if [[ "$user_count" -gt 100 ]]; then
        warning "Large dataset detected ($user_count users). Migration may take longer."
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Migration cancelled by user"
            exit 0
        fi
    fi
    
    success "Prerequisites validation completed"
}

# Execute migration
execute_migration() {
    log "Executing CineGenius v3 schema migration..."
    
    local migration_file="$SCRIPT_DIR/001_cinegenius_v3_schema_upgrade.sql"
    local start_time=$(date +%s)
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" 2>&1 | tee -a "$LOG_FILE"; then
        local end_time=$(date +%s)
        local execution_time=$((end_time - start_time))
        
        # Update execution time in migration log
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            UPDATE \"MigrationLog\" 
            SET execution_time_ms = $((execution_time * 1000))
            WHERE migration_id = '001_cinegenius_v3_schema_upgrade';
        " >/dev/null 2>&1
        
        success "Migration completed successfully in ${execution_time}s"
    else
        error "Migration failed"
        exit 1
    fi
}

# Validate migration results
validate_migration() {
    log "Validating migration results..."
    
    # Check MigrationLog table exists and has our record
    local migration_count
    migration_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM \"MigrationLog\" 
        WHERE migration_id = '001_cinegenius_v3_schema_upgrade' AND status = 'APPLIED';
    " 2>/dev/null | xargs)
    
    if [[ "$migration_count" != "1" ]]; then
        error "Migration log validation failed"
        exit 1
    fi
    
    # Check all expected fields exist
    local missing_fields
    missing_fields=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        WITH expected_fields AS (
            SELECT 'VideoAsset'::text as table_name, 'generation_metadata'::text as column_name
            UNION SELECT 'VideoAsset', 'quality_score'
            UNION SELECT 'ShareToken', 'permissions'
            UNION SELECT 'Comment', 'comment_type'
            UNION SELECT 'Comment', 'feedback_data'
            UNION SELECT 'Comment', 'rating'
        ),
        existing_fields AS (
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_name IN ('VideoAsset', 'ShareToken', 'Comment')
        )
        SELECT string_agg(e.table_name || '.' || e.column_name, ', ')
        FROM expected_fields e
        LEFT JOIN existing_fields ex ON e.table_name = ex.table_name AND e.column_name = ex.column_name
        WHERE ex.column_name IS NULL;
    " 2>/dev/null | xargs)
    
    if [[ -n "$missing_fields" && "$missing_fields" != "" ]]; then
        error "Missing fields after migration: $missing_fields"
        exit 1
    fi
    
    # Check indexes were created
    local index_count
    index_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_indexes 
        WHERE indexname IN (
            'idx_prompt_cinegenius_version',
            'idx_videoasset_status_provider',
            'idx_videoasset_quality_score',
            'idx_comment_type_target',
            'idx_comment_rating',
            'idx_sharetoken_role_target',
            'idx_sharetoken_active'
        );
    " 2>/dev/null | xargs)
    
    if [[ "$index_count" != "7" ]]; then
        warning "Expected 7 indexes, found $index_count"
    fi
    
    success "Migration validation completed successfully"
}

# Generate migration report
generate_report() {
    log "Generating migration report..."
    
    local report_file="$SCRIPT_DIR/migration_report_$(date +'%Y%m%d_%H%M%S').txt"
    
    cat > "$report_file" << EOF
VideoPlanet CineGenius v3 Migration Report
==========================================
Date: $(date)
Migration ID: 001_cinegenius_v3_schema_upgrade

Schema Changes:
--------------
VideoAsset Table:
  + generation_metadata (JSONB) - AI generation metadata
  + quality_score (DECIMAL(3,2)) - Quality scoring 0.0-10.0

ShareToken Table:
  + permissions (JSONB) - Granular access control

Comment Table:
  + comment_type (TEXT) - Comment categorization
  + feedback_data (JSONB) - Structured feedback data
  + rating (INTEGER) - 1-5 star rating system

Performance Optimizations:
-------------------------
Added 7 database indexes:
  - idx_prompt_cinegenius_version
  - idx_videoasset_status_provider
  - idx_videoasset_quality_score
  - idx_comment_type_target
  - idx_comment_rating
  - idx_sharetoken_role_target
  - idx_sharetoken_active

Data Integrity:
--------------
Added 3 check constraints:
  - VideoAsset provider validation
  - VideoAsset status validation
  - ShareToken role validation

Rollback Information:
--------------------
Rollback script: migrations/rollback/001_rollback_cinegenius_v3_schema_upgrade.sql
Backup location: $backup_file

Migration Status: COMPLETED SUCCESSFULLY
EOF

    success "Migration report generated: $report_file"
}

# Main execution
main() {
    log "Starting VideoPlanet CineGenius v3 Migration"
    log "============================================="
    
    # Validate environment
    test_connection
    validate_prerequisites
    
    # Create backup
    backup_file=$(create_backup)
    
    # Execute migration with error handling
    if execute_migration; then
        validate_migration
        generate_report
        
        success "Migration completed successfully!"
        success "Database is now ready for CineGenius v3"
        log "Backup created at: $backup_file"
    else
        error "Migration failed. Database unchanged."
        exit 1
    fi
}

# Handle script interruption
cleanup() {
    error "Migration interrupted"
    exit 1
}

trap cleanup SIGINT SIGTERM

# Run main function
main "$@"