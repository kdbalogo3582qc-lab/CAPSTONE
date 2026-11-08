ALTER TABLE video_reviews ADD COLUMN pending_options_json LONGTEXT NULL,
    ADD COLUMN guideline_version VARCHAR(100) NULL;

CREATE TABLE analysis_runs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    review_id CHAR(36) NOT NULL,
    request_key VARCHAR(100) NOT NULL,
    identity_hash CHAR(64) NOT NULL,
    file_hash CHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    execution_kind VARCHAR(20) NOT NULL,
    source_run_id CHAR(36) NULL,
    metadata_json LONGTEXT NOT NULL,
    result_json LONGTEXT NULL,
    error_code VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    UNIQUE KEY run_request (user_id, request_key),
    KEY completed_identity (user_id, identity_hash, status),
    KEY reviewed_runs (user_id, review_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE analysis_identity_locks (
    user_id INT NOT NULL,
    identity_hash CHAR(64) NOT NULL,
    lease_token CHAR(36) NULL,
    lease_until DATETIME NULL,
    PRIMARY KEY (user_id, identity_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
