
CREATE TABLE video_reviews (
    id CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    video_path VARCHAR(512) NOT NULL,
    file_hash CHAR(64) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    phase VARCHAR(32) NOT NULL DEFAULT 'uploaded',
    review_json LONGTEXT NULL,
    result_json LONGTEXT NULL,
    acknowledged_at VARCHAR(32) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    UNIQUE KEY unique_review_upload (video_path),
    KEY review_owner (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
