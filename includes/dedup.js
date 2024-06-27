function dedup(table_name, col_name, interval_time = -1, last_updated_time = true) {
  /* */
  if(interval_time == -1){
    condition = " "
  }
  else{
    condition = `where created_time > timestamp( current_datetime() - ${interval_time})
    and ingest_time > timestamp( current_datetime() - ${interval_time})`
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

