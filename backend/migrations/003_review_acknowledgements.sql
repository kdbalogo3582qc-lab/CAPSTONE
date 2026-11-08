-- Apply once after migrations 001 and 002. Existing reviews/results are preserved.
CREATE TABLE video_review_acknowledgements (
    user_id INT NOT NULL,
    review_id CHAR(36) NOT NULL,
    request_key VARCHAR(100) NOT NULL,
    identity_hash CHAR(64) NOT NULL,
    acknowledged_at VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, review_id, request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
