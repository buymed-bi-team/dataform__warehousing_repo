// Create_function

function csvToSQL (sample_csv, value_prediction = null) {
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
    */
    // Split the CSV data into lines
    const lines = sample_csv.trim().split('\n').filter(line => line.trim() !== '').map(line => line.trim());

    // Get the header line
    header = lines[0].split(',');

    // if (value_prediction !== null) { 
    //     if (header.includes('`')) {value_prediction = '`'}
    //     else if (header.includes(`"`)) {value_prediction = `"`}
    //     else if (header.includes(`'`)) {value_prediction = `'`}
    // }
    if (value_prediction !== null) { header = header.map((x) => x.trim().split(value_prediction)[1])}

    sql = ``;

    // Process each line of the CSV (except the header)
    lines.slice(1).forEach((line, row_i) => {
        let sql_line = ""

        line.split(',').forEach((value,col_i) => {
            if (value == "") {
                value = "Null"
            }
            else {
                if (value_prediction !== null) { value = value.split(value_prediction)[1] }
                if ( value !== undefined ) { if (value.includes('`')) {value = value.replace('`','\`')} }
                if ( value !== undefined ) { if (value.includes('"')) {value = value.replace('"','\"')} }
                if ( value !== undefined ) { if (value.includes(`'`)) {value = value.replace(`'`,`\'`)} }
                value = `'${value}'`
            }
            sql_line += `${value} as ${header[col_i]} ${col_i < header.length - 1 ? ',':''}`  
        });

        sql += `  SELECT ${sql_line}${row_i < lines.length - 2 ? ' UNION ALL' : ''}\n`;
    });

    return sql
}

module.exports = { csvToSQL  };

