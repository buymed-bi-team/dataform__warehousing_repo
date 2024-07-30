function csvToBigQuerySQL (sample_csv, real_table_name) {
    // Split the CSV data into lines
    const lines = sample_csv.split('\n').filter(line => line.trim() !== '');

    // Get the header line
    const header = lines[0].split(',');

    // Initialize the SQL statement with the WITH clause
    let sql = `WITH unittest AS (\n`;

    // Process each line of the CSV (except the header)
    lines.slice(1).forEach((line, row_i) => {
        let sql_line = ""

        line.split(',').forEach((value,col_i) => {
            sql_line += `'${value}' as ${header[col_i]} ${col_i < header.length - 1 ? ',':''}`  
        });

        sql += `  SELECT ${sql_line}${row_i < lines.length - 2 ? ' UNION ALL' : ''}\n`;
    });

    sql += `)\n\n`;

    sql += `SELECT DISTINCT t.*, h.location_code, h.shelf_type, h.zone_key, h.shelf_key, h.shelf_level, h.location_number_key, h.layout_key, h.location_key\n`;
    sql += `FROM ${real_table_name} h\n`;
    sql += `RIGHT JOIN unittest t ON h.location_code = t.location_code_test\n`;
    sql += `WHERE t.shelf_type_test != h.shelf_type OR\n`;
    sql += `      t.zone_key_test != h.zone_key OR\n`;
    sql += `      t.shelf_key_test != h.shelf_key OR\n`;
    sql += `      t.shelf_level_test != h.shelf_level OR\n`;
    sql += `      t.location_number_key_test != h.location_number_key OR\n`;
    sql += `      t.layout_key_test != h.layout_key OR\n`;
    sql += `      t.location_key_test != h.location_key`;

    return sql
}
module.exports = { csvToBigQuerySQL };

