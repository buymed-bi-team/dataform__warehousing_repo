function generateCDCScript({
  postgresDatabase,
  tableName,
  dataset,
  rawTable,
  medataTable = 'circa_v2_schema_metadata',
  targetDataset,
  targetTable,
  primaryKey      = 'id',
  createdTime     = 'created_at',
  timezone        = 'Asia/Ho_Chi_Minh',
  lookbackHours   = 2,
}) {
const colExprCase = `
  CASE
    WHEN is_array = TRUE AND bq_type = 'JSON'
      THEN CONCAT(
        'JSON_QUERY(data, \\'$.after.',
        name,
        '\\') AS \`',
        name,
        '\`'
      )

    WHEN is_array = TRUE AND bq_type != 'JSON'
      THEN CONCAT(
        'JSON_QUERY(JSON_QUERY(data,\\'$.after\\'), \\'$.', name, '\\') AS \`',
        name,
        '\`'
      )

    WHEN bq_type IN ('INT64','INT32','FLOAT64','NUMERIC','BIGNUMERIC','BOOLEAN','DATE','DATETIME','TIMESTAMP','TIME','INTEGER','FLOAT')
      THEN CONCAT(
        'SAFE_CAST(JSON_VALUE(JSON_QUERY(data,\\'$.after\\'), \\'$.', name, '\\') AS ',
        CASE bq_type
          WHEN 'FLOAT' THEN 'FLOAT64'
          WHEN 'INT32' THEN 'INT64'
          ELSE bq_type
        END,
        ') AS \`',
        name,
        '\`'
      )

    WHEN bq_type = 'JSON' AND is_array = FALSE
      THEN CONCAT(
        'JSON_QUERY(data, \\'$.after.',
        name,
        '\\') AS \`',
        name,
        '\`'
      )

    ELSE CONCAT(
      'JSON_VALUE(JSON_QUERY(data,\\'$.after\\'), \\'$.', name, '\\') AS \`',
      name,
      '\`'
    )
  END
`;

  //   is_array              -> JSON_QUERY(...)        -> JSON
  //   bq_type = JSON        -> PARSE_JSON(...)        -> JSON
  //   numeric/date group    -> SAFE_CAST(... AS T)    -> T (INT32/INTEGER normalized to INT64)
  //   others                -> JSON_VALUE(...)        -> STRING
  const colDdlTypeCase = `
    CASE
      WHEN CAST(col.is_array AS BOOL) = TRUE THEN 'JSON'
      WHEN col.bq_type = 'JSON' THEN 'JSON'
      WHEN col.bq_type IN ('INT64','INT32','INTEGER') THEN 'INT64'
      WHEN col.bq_type IN ('FLOAT64','NUMERIC','BIGNUMERIC','BOOLEAN','DATE','DATETIME','TIMESTAMP','TIME')
        THEN col.bq_type
      ELSE 'STRING'
    END
  `;

  const colNameList = `name`;

  const destTable = `\`lakehouse-prod-394907.${targetDataset}.${targetTable}\``;
  const srcTable  = `\`lakehouse-prod-394907.${dataset}.${rawTable}\``;
  const schemaMetaTable = `\`lakehouse-prod-394907.${dataset}.${medataTable}\``;

  return `
    DECLARE ingest_checkpoint TIMESTAMP;
    DECLARE has_deletes BOOLEAN;
    DECLARE affected_dates ARRAY<DATE>;
    DECLARE table_exists BOOL;
    DECLARE flatten_sql STRING;
    DECLARE select_body STRING;
    DECLARE col_list STRING;
    DECLARE add_columns_sql STRING;

    -- ── 1. Check if table exists ──────────────────────────────────────────
    SET table_exists = (
      SELECT COUNT(*) > 0
      FROM \`lakehouse-prod-394907.${targetDataset}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name = '${targetTable}'
    );

    -- ── 2. Get checkpoint ─────────────────────────────────────────────────
    IF table_exists THEN
      SET ingest_checkpoint = (
        SELECT COALESCE(MAX(publish_time), TIMESTAMP('2000-01-01'))
        FROM ${destTable}
      );
    ELSE
      SET ingest_checkpoint = TIMESTAMP('2000-01-01');
    END IF;

    -- ── 3. PreOps: delete affected partitions (only when table already exists) ─
    IF table_exists THEN

      SET has_deletes = (
        SELECT COUNTIF(JSON_VALUE(data,'$.operation') = 'DELETE') > 0
        FROM ${srcTable}
        WHERE publish_time > TIMESTAMP_SUB(ingest_checkpoint, INTERVAL ${lookbackHours} HOUR)
      );

      IF has_deletes THEN
        SET affected_dates = ARRAY(
          SELECT DISTINCT created_date
          FROM ${destTable}
          WHERE ${primaryKey} IN (
            SELECT JSON_VALUE(data,'$.primary_key.${primaryKey}')
            FROM ${srcTable}
            WHERE publish_time > TIMESTAMP_SUB(ingest_checkpoint, INTERVAL ${lookbackHours} HOUR)
          )
        );
      ELSE
SET affected_dates = ARRAY(
          SELECT DISTINCT created_date
          FROM (
            SELECT
              CASE
                WHEN JSON_VALUE(JSON_QUERY(data,'$.after'),'$.${createdTime}') IS NOT NULL
                THEN DATE(DATETIME(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S%Ez',
                       JSON_VALUE(JSON_QUERY(data,'$.after'),'$.${createdTime}')), '${timezone}'))
                ELSE DATE('1900-01-01')
              END AS created_date
            FROM ${srcTable}
            WHERE publish_time > TIMESTAMP_SUB(ingest_checkpoint, INTERVAL ${lookbackHours} HOUR)
          )
          WHERE created_date IS NOT NULL
        );
      END IF;

      IF ARRAY_LENGTH(affected_dates) > 0 THEN
        DELETE FROM ${destTable}
        WHERE created_date IN UNNEST(affected_dates)
          AND CAST(${primaryKey} AS STRING) IN (
            SELECT JSON_VALUE(data,'$.primary_key.${primaryKey}')
            FROM ${srcTable}
            WHERE publish_time > TIMESTAMP_SUB(ingest_checkpoint, INTERVAL ${lookbackHours} HOUR)
          );
      END IF;

    END IF;

    -- ── 3.5 Schema evolution: if table exists and schema has new columns → ADD COLUMN ─
    --   Use ADD COLUMN IF NOT EXISTS so BQ skips existing columns (batch multiple columns in one statement).
    --   Type is derived from colDdlTypeCase to match the values produced by SELECT.
    IF table_exists THEN
      SET add_columns_sql = (
        SELECT CONCAT(
          'ALTER TABLE ${destTable} ',
          STRING_AGG(
            CONCAT('ADD COLUMN IF NOT EXISTS ', name, ' ', ddl_type),
            ', ' ORDER BY col_offset
          )
        )
        FROM (
          SELECT
            col.name        AS name,
            col_offset,
            ${colDdlTypeCase} AS ddl_type
          FROM ${schemaMetaTable},
          UNNEST(columns) col WITH OFFSET col_offset
          WHERE tablename = '${tableName}' AND databasename = '${postgresDatabase}'
            AND col.name NOT IN ('_cdc_op','_cdc_ts','_ingested_at')
        )
      );

      -- STRING_AGG returns NULL when no columns → CONCAT produces NULL → skip
      IF add_columns_sql IS NOT NULL THEN
        EXECUTE IMMEDIATE add_columns_sql;
      END IF;
    END IF;

    -- ── 4. Build select body + column list (shared for both CREATE & INSERT) ──
    SET (select_body, col_list) = (
      WITH schema AS (
        SELECT col.name, col.bq_type, CAST(col.is_array AS BOOL) AS is_array, col_offset
        FROM ${schemaMetaTable},
        UNNEST(columns) col WITH OFFSET col_offset
        WHERE tablename = '${tableName}' AND databasename = '${postgresDatabase}'
          AND col.name NOT IN ('_cdc_op','_cdc_ts','_ingested_at')
      )
      SELECT AS STRUCT
        CONCAT(
          -- ── WITH winners ──
          ' WITH winners AS (',
          '   SELECT',
          '     JSON_VALUE(data,\\'$.primary_key.${primaryKey}\\') AS id,',
          '     ARRAY_AGG(message_id ORDER BY',
          '       SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) DESC,',
          '       IF(JSON_VALUE(data,\\'$.operation\\')=\\'DELETE\\',3,',
          '         IF(JSON_VALUE(data,\\'$.operation\\')=\\'UPDATE\\',2,1)) DESC',
          '       LIMIT 1)[OFFSET(0)] AS winning_message_id,',
          '     ARRAY_AGG(JSON_VALUE(data,\\'$.operation\\') ORDER BY',
          '       SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) DESC',
          '       LIMIT 1)[OFFSET(0)] AS action',
          '   FROM ${srcTable}',
          '   WHERE JSON_VALUE(data,\\'$.primary_key.${primaryKey}\\') IS NOT NULL',
          '     AND publish_time > TIMESTAMP_SUB(TIMESTAMP(\\'', CAST(ingest_checkpoint AS STRING), '\\'), INTERVAL ${lookbackHours} HOUR)',
          '   GROUP BY id',
          '   HAVING action != \\'DELETE\\'',
          ' )',

  -- ── SELECT (dynamic cols first, sync_at, publish_time + created_date appended at the end) ──
          ' SELECT ',
          STRING_AGG(${colExprCase}, ', ' ORDER BY col_offset),   -- ← dynamic col expressions
          ',   SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) AS sync_at',
          ',   publish_time AS publish_time',
          ',   CASE WHEN JSON_VALUE(JSON_QUERY(data,\\'$.after\\'),\\'$.${createdTime}\\') IS NOT NULL',
          '   THEN DATE(DATETIME(SAFE.PARSE_TIMESTAMP(\\'%Y-%m-%d %H:%M:%E*S%Ez\\',',
          '     JSON_VALUE(JSON_QUERY(data,\\'$.after\\'),\\'$.${createdTime}\\')),\\'${timezone}\\'))',
          '   ELSE DATE(\\'2099-01-01\\') END AS created_date',
          ' FROM ${srcTable} r',
          ' JOIN winners w ON r.message_id = w.winning_message_id'
        ),
        STRING_AGG(${colNameList}, ', ' ORDER BY col_offset)       -- ← dynamic col names
      FROM schema
    );

    -- ── 5. Table does not exist → CREATE TABLE AS SELECT; already exists → INSERT INTO ──
    IF table_exists THEN
      SET flatten_sql = CONCAT(
        'INSERT INTO ${destTable}',
        ' (', col_list, ', sync_at, publish_time, created_date) ',
        select_body
      );
    ELSE
      SET flatten_sql = CONCAT(
        'CREATE TABLE ${destTable}',
        ' PARTITION BY created_date',
        ' CLUSTER BY ${primaryKey}',
        ' AS ',
        select_body
      );
    END IF;

    EXECUTE IMMEDIATE flatten_sql;
  `;
}

module.exports = { generateCDCScript };