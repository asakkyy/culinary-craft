CREATE TABLE authentication_limits (
    bucket VARCHAR(64) PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL
);
CREATE INDEX authentication_limits_expiry ON authentication_limits(window_start);
