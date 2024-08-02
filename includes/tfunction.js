function csvToSQL (sample_csv, real_table_name, using_columns) {
    /*
        PIC: minhluu
        description: Convert the text in CSV format to SQL in BigQuery, serving for unittest
        Parameters:
            - sample_csv : TEXT in csv format, for example:
                `
                location_code,shelf_type,zone_key,shelf_key,shelf_level,location_number_key,layout_key,location_key
                E1A01A01,MEDIUM_GRAY,E1,A01,A,01,E1A01,A01
                E1A01A02,MEDIUM_GRAY,E1,A01,A,02,E1A01,A02
                E1A01A03,MEDIUM_GRAY,E1,A01,A,03,E1A01,A03
                E1A01A04,MEDIUM_GRAY,E1,A01,A,04,E1A01,A04
                `
            - real_table_name : The table that you want to unittest
                for example: "${ref(`dim_fc_location`)}"
            - using_columns : the columns in that you want to join between unittest and real_table
                For example: "location_code , code_2"
    */
    // Split the CSV data into lines

    const lines = sample_csv.trim().split('\n').filter(line => line.trim() !== '').map(line => line.trim());

    // Get the header line
    const header = lines[0].split(',');

    // Initialize the SQL statement with the WITH clause
    let sql = `WITH unittest AS (\n`;

    // Process each line of the CSV (except the header)
    lines.slice(1).forEach((line, row_i) => {
        let sql_line = ""

        line.split(',').forEach((value,col_i) => {
            sql_line += `'${value}' as ${header[col_i]}_t ${col_i < header.length - 1 ? ',':''}`  
        });

        sql += `  SELECT ${sql_line}${row_i < lines.length - 2 ? ' UNION ALL' : ''}\n`;
    });

    sql += `)\n\n`;

    sql += `SELECT DISTINCT t.*, `;
    
    header.forEach((x,i) => {
        sql += `h.${x}${i < header.length - 1 ? ', ':'\n'}`
    })

    sql += `FROM ${real_table_name} h\n`;
    sql += `LEFT JOIN unittest t \nON `;

    on_cols = using_columns.split(',')
    on_cols.forEach((x,i) => {
        x = x.trim()
        sql += `h.${x} = t.${x}_t ${i < on_cols.length - 1 ? '\n\tAND ' :'\nWHERE '}`
    })

    header.forEach((h,i) => {
        sql += `t.${h}_t != h.${h}${i < header.length - 1 ? '\n\tOR ':''}`
    })

    return sql
}



module.exports = { csvToSQL };

