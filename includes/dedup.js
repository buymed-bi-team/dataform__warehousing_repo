function dedup(table_name, col_name , start_timestamp = null, last_updated_time = true) {
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
  condition = " "
  if (start_timestamp == null){
    let condition = " ";
  }
  else {
    let condition = `where ingest_time > ${start_timestamp}
    and created_time > ${start_timestamp}`;
  }
  if (last_updated_time == true){
    updated_time_consider = ", last_updated_time DESC";
  }
  return condition
  // return `(
  //   select 
  //       mg_id,
  //       synced_at,
  //       last_updated_time, 
  //       ${col_name}
  //   from ${table_name} 
  //   `.concat(
  //     condition , 
  //     `QUALIFY ROW_NUMBER() OVER(_window) = 1 AND FIRST_VALUE(action) over(_window) <> 'd'
  //     WINDOW _window AS (PARTITION BY mg_id ORDER BY synced_at DESC, IF(action='d',3,IF(action='u',2,1)) DESC`,
  //     updated_time_consider,
  //     `))`
  // );
}
module.exports = { dedup };

