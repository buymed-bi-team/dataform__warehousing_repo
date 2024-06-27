function dedup(table_name, col_name , interval_time = -1, incremental = false, last_updated_time = true) {
  /* 
  Function returns table after deduplicate cause of mongodb
  Parameters:
    - table_name: STRING : table name to deduplicate
    - col_name: STRING : all column you want to get, example:
        * Get all column : col_name= "*"
        * Get multiple column : col_name = "column_1,column_2"
        * Get only one column : col_name = "specific_column"
    - interval_time : STRING : (Optional) The number of time before today for which you want to retrieve data up to the current day, For example:
        * interval_time = "interval 3 month"
        * interval_time = "interval 1 day"
    - incremental: boolean : (Optional) to filter data in period of interval_time you want to update when implement incremental model
        - for example if you implement incremental model, you want to update today data then set:
            incremental = true, interval_time = "interval 1 day" 
    - last_updated_time : Boolean : (Optional) Some having duplicate table doesn't have last_updated_time, if hasn't then set last_updated_time=false
  */
  condition = " "
  if(interval_time != -1){
    if(incremental != false){
      condition.concat(
      `
      \${when(incremental(),
      "where created_time > timestamp( current_datetime() - ${interval_time}) and ingest_time > timestamp( current_datetime() - ${interval_time})",
      "")}`
      )
    }
    else{
      condition.concat( `where created_time > timestamp( current_datetime() - ${interval_time})
      and ingest_time > timestamp( current_datetime() - ${interval_time})`)
    }
  }
  if (last_updated_time == false){
    updated_time_consider = " "
  }
  else{
    updated_time_consider = ", last_updated_time DESC"
  }
  return `(
    select 
        mg_id,
        synced_at,
        last_updated_time, 
        ${col_name}
    from ${table_name} 
    `.concat(
      condition , 
      `QUALIFY ROW_NUMBER() OVER(_window) = 1 AND FIRST_VALUE(action) over(_window) <> 'd'
      WINDOW _window AS (PARTITION BY mg_id ORDER BY synced_at DESC, IF(action='d',3,IF(action='u',2,1)) DESC`,
      updated_time_consider,
      `))`
  );
}
module.exports = { dedup };

