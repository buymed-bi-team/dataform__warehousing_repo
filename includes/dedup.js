function dedup(arg1, arg2, arg3 = null, arg4 = true) {
  // Support both call styles:
  // - dedup(table_name, col_name, start_timestamp?, last_updated_time?)
  // - dedup({ table_name, col_name|column_name, start_timestamp?, last_updated_time? })
  let table_name, col_name, start_timestamp, last_updated_time;

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    const opts = arg1;
    table_name = opts.table_name;
    // accept both 'col_name' and 'column_name'
    col_name = opts.col_name ?? opts.column_name ?? '*';
    start_timestamp = opts.start_timestamp ?? null;
    last_updated_time = opts.last_updated_time ?? true;
  } else {
    table_name = arg1;
    col_name = arg2 ?? '*';
    start_timestamp = arg3 ?? null;
    last_updated_time = arg4 ?? true;
  }

  /* 
  Function returns table after deduplicate cause of mongodb
  Parameters:
    - table_name: STRING : table name to deduplicate
    - col_name: STRING : all column you want to get, example:
        * Get all column : col_name= "*"
        * Get multiple column : col_name = "column_1,column_2"
        * Get only one column : col_name = "specific_column"
    - start_timestamp : timestamp : (Optional) The start date in timestamp format, For example:
        * start_timestamp = TIMESTAMP( current_datetime() - interval 1 month)
    - last_updated_time : Boolean : (Optional) Some having duplicate table doesn't have last_updated_time, if hasn't then set last_updated_time=false
  */

  // Build WHERE condition if start_timestamp provided
  let condition = ' ';
  if (start_timestamp != null) {
    condition = `where ingest_time > ${start_timestamp} `;
  }

  // Add last_updated_time only when requested
  let updated_time_consider = '';
  if (last_updated_time === true) {
    updated_time_consider = ', last_updated_time DESC';
  }

  const colStr = (typeof col_name === 'string') ? col_name.trim() : '*';
  let cols = " ";
  if (colStr === '*') {
    cols = '*'
  } else { 
    cols = `mg_id,synced_at,last_updated_time,
        ${col_name} ` 
  }

  return `(
    select ${cols}
    from ${table_name} 
    ${condition} 
    QUALIFY ROW_NUMBER() OVER(_window) = 1 AND FIRST_VALUE(action) over(_window) <> 'd'
    WINDOW _window AS (PARTITION BY mg_id ORDER BY synced_at DESC, IF(action='d',3,IF(action='u',2,1)) DESC
    ${updated_time_consider})
  )`
}
module.exports = { dedup };

