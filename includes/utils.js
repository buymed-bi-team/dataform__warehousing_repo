function ToTimezone (column_name) {
    return `DATETIME(${column_name},'+7')`
}


module.exports = { ToTimezone };