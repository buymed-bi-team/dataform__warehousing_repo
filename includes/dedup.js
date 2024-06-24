function dedup() {
    return `
        WINDOW
        _window AS (
        PARTITION BY
            mg_id
        ORDER BY
            synced_at DESC,
        IF
            (action='d',3,
            IF
            (action='u',2,1)) DESC,
            last_updated_time DESC)
    `;
}

module.exports = { dedup };