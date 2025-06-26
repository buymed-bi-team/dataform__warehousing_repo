DECLARE _table_schema STRING;
DECLARE _table_name STRING;

SET _table_schema = "silver_buymed_vn";
SET _table_name = "monitoring_prd_collector_user_stats";


SELECT 
  FORMAT(
  """
  WITH silver AS (
    SELECT
      %s,
      %s created_date,
      CAST(null as datetime) 
    FROM %s
    WHERE ingest_time >= CURRENT_TIMESTAMP() - INTERVAL 1 DAY
    QUALIFY ROW_NUMBER() OVER (_window) = 1 
          AND ingest_time >= CURRENT_TIMESTAMP() - INTERVAL 16 HOUR
          WINDOW _window AS (
          PARTITION BY mg_id
          ORDER BY synced_at DESC,
          IF
              (action='d',3,
              IF
              (action='u',2,1)) DESC
          %s)
  ), platinum AS (
    SELECT 
      %s,
      created_date,
      platinum_refresh
    FROM %s
  )
  SELECT p.*
  FROM platinum p
  LEFT JOIN silver s 
      ON p.mg_id = s.mg_id 
  WHERE s.mg_id is null 

  UNION ALL 

  SELECT s.*
  FROM silver s
  WHERE action <> "d"
  """
  , STRING_AGG(column_name)
  , IF( 
    MAX(column_name like "created_time") = TRUE,  
    """
        CASE
            WHEN created_time IS NOT NULL THEN DATE(DATETIME(created_time, 'Asia/Ho_Chi_Minh'))
            ELSE DATE( '2099-01-01' )
        END
    """,
    """
        CASE
            WHEN silver_buymed_vn.MONGOID_TIMESTAMP(mg_id) IS NOT NULL THEN DATE(DATETIME(silver_buymed_vn.MONGOID_TIMESTAMP(mg_id), 'Asia/Ho_Chi_Minh'))
            ELSE DATE( '2099-01-01' )
        END
    """
    )
  , table_schema || "." || table_name
  , IF(
    MAX(column_name like "last_updated_time") = TRUE,
    ",last_updated_time DESC",
    ""
    )
  , STRING_AGG(column_name)
  , "${ref(`" || REPLACE(table_schema,"silver","platinum") || "__stg`, `"|| table_name || "`)}"
  )
FROM `region-asia-southeast1.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name like _table_name
AND table_schema like _table_schema
GROUP BY table_schema, table_name
