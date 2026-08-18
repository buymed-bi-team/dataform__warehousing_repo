function generateCDCScript({
  postgresDatabase,
  tableName,
  dataset,
  rawTable,
  medataTable   = 'circa_v2_schema_metadata',
  stgDataset,                     // dataset của bảng staging (thay cho targetDataset cũ)
  stgTable,                       // bảng staging: CDC nạp/merge vào đây, chạy 1 lần/ngày
  viewDataset,                    // dataset của view
  viewTable,                      // view = stgTable + delta mới nhất từ raw
  primaryKey    = 'id',           // string | string[] — hỗ trợ composite primary key (nhiều cột)
  createdTime   = 'created_at',
  timezone      = 'Asia/Ho_Chi_Minh',
  lookbackHours = 2,
  pkSeparator   = ':::',          // dùng để nối các phần tử của composite key thành 1 chuỗi định danh duy nhất
  project       = 'lakehouse-prod-394907',
}) {
  // ── Validate tham số bắt buộc (trước đây targetDataset/targetTable bị comment
  //    nhưng vẫn dùng trong body → ReferenceError) ─────────────────────────────
  const required = {
    postgresDatabase, tableName, dataset, rawTable,
    stgDataset, stgTable, viewDataset, viewTable,
  };
  for (const [key, value] of Object.entries(required)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${key} là bắt buộc và phải là string khác rỗng`);
    }
  }

  // ── Chuẩn hoá primaryKey về dạng mảng để dùng chung logic cho 1 hay nhiều cột ──
  const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];

  if (primaryKeys.length === 0) {
    throw new Error('primaryKey phải có ít nhất 1 phần tử');
  }
  if (primaryKeys.some((k) => typeof k !== 'string' || !k.trim())) {
    throw new Error('Mỗi phần tử của primaryKey phải là string khác rỗng');
  }
  if (pkSeparator.includes("'")) {
    throw new Error("pkSeparator không được chứa dấu nháy đơn (')");
  }

  const pkJsonParts = primaryKeys.map(
    (k) => `JSON_VALUE(data,\\'$.primary_key.${k}\\')`
  );
  const pkIdExpr = pkJsonParts.length === 1
    ? pkJsonParts[0]
    : `CONCAT(${pkJsonParts.join(`, \\'${pkSeparator}\\', `)})`;

  const pkNotNullExpr = primaryKeys
    .map((k) => `JSON_VALUE(data,\\'$.primary_key.${k}\\') IS NOT NULL`)
    .join(' AND ');

  const clusterByExpr = primaryKeys.join(', ');

  // Dùng cho MERGE ... ON và cho nhánh base của view (bảng stg alias T)
  const pkTargetParts = primaryKeys.map((k) => `CAST(T.${k} AS STRING)`);
  const pkTargetExpr = pkTargetParts.length === 1
    ? pkTargetParts[0]
    : `CONCAT(${pkTargetParts.join(`, \\'${pkSeparator}\\', `)})`;

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
        '(SELECT CASE',
        '  WHEN v IS NULL THEN NULL',
        '  WHEN v = \\'{}\\' THEN PARSE_JSON(\\'[]\\')',
        '  WHEN NOT (STARTS_WITH(v, \\'{\\') AND ENDS_WITH(v, \\'}\\')) THEN PARSE_JSON(TO_JSON_STRING(v))',
        '  ELSE PARSE_JSON(TO_JSON_STRING(ARRAY(',
        '    SELECT CASE WHEN TRIM(elem) = \\'NULL\\' THEN CAST(NULL AS STRING) ELSE TRIM(TRIM(elem), \\'"\\') END',
        '    FROM UNNEST(SPLIT(SUBSTR(v, 2, LENGTH(v) - 2), \\',\\')) AS elem',
        '  ))) END',
        ' FROM (SELECT JSON_VALUE(JSON_QUERY(data,\\'$.after\\'), \\'$.', name, '\\') AS v)',
        ') AS \`', name, '\`'
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

  const stgRef          = `\`${project}.${stgDataset}.${stgTable}\``;
  const viewRef         = `\`${project}.${viewDataset}.${viewTable}\``;
  const srcTable        = `\`${project}.${dataset}.${rawTable}\``;
  const schemaMetaTable = `\`${project}.${dataset}.${medataTable}\``;

  return `
    DECLARE ingest_checkpoint TIMESTAMP;
    DECLARE view_checkpoint   TIMESTAMP;   -- checkpoint SAU khi nạp stg, dùng cho view
    DECLARE table_exists BOOL;
    DECLARE add_columns_sql STRING;

    DECLARE select_tpl STRING;    -- nguồn (source) dùng chung cho MERGE / CTAS / VIEW
                                  -- chứa placeholder '@@CKPT@@' cho mốc thời gian
    DECLARE col_list   STRING;    -- danh sách cột để INSERT / UNION
    DECLARE update_set STRING;    -- \`col\` = S.\`col\` cho UPDATE
    DECLARE insert_vals STRING;   -- S.\`col\` cho VALUES
    DECLARE dml_sql STRING;
    DECLARE view_sql STRING;

    -- ── 1. Bảng staging đã tồn tại chưa ────────────────────────────────────
    SET table_exists = (
      SELECT COUNT(*) > 0
      FROM \`${project}.${stgDataset}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name = '${stgTable}'
    );

    -- ── 2. Checkpoint (MERGE cập nhật publish_time nên MAX vẫn tiến đúng) ───
    IF table_exists THEN
      SET ingest_checkpoint = (
        SELECT COALESCE(MAX(publish_time), TIMESTAMP('2000-01-01'))
        FROM ${stgRef}
      );
    ELSE
      SET ingest_checkpoint = TIMESTAMP('2000-01-01');
    END IF;

    -- ── 3. Schema evolution: thêm cột mới nếu metadata có cột chưa tồn tại ──
    IF table_exists THEN
      SET add_columns_sql = (
        SELECT CONCAT(
          'ALTER TABLE ${stgRef} ',
          STRING_AGG(
            CONCAT('ADD COLUMN IF NOT EXISTS \`', name, '\` ', ddl_type),
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
      IF add_columns_sql IS NOT NULL THEN
        EXECUTE IMMEDIATE add_columns_sql;
      END IF;
    END IF;

    -- ── 4. Dựng source select + các mệnh đề cột (dùng chung MERGE/CTAS/VIEW) ─
    --   winners: gom theo primary_key (có thể là composite key nhiều cột),
    --   chọn bản mới nhất theo sync_at, tie-break theo độ ưu tiên op
    --   (DELETE>UPDATE>INSERT). action & winning_message_id DÙNG CHUNG order by
    --   để không lệch nhau.
    --   KHÔNG lọc DELETE ở đây — để MERGE (và view) tự xử lý xoá.
    --   Raw được dedup theo message_id (ROW_NUMBER, lấy dòng đầu) trước khi
    --   join winners: pubsub có thể deliver trùng message_id, nếu không dedup
    --   thì 1 winning_message_id join ra nhiều dòng source → MERGE lỗi
    --   "must match at most one source row for each target row".
    --   _cdc_pk = chuỗi nối tất cả các phần tử của primary_key (theo
    --   pkSeparator, đúng thứ tự) — hợp lệ cả với DELETE vì after = null.
    --   '@@CKPT@@' là placeholder: MERGE/CTAS thay bằng ingest_checkpoint,
    --   VIEW thay bằng view_checkpoint (mốc sau khi stg đã nạp xong).
    SET (select_tpl, col_list, update_set, insert_vals) = (
      WITH schema AS (
        SELECT col.name, col.bq_type, CAST(col.is_array AS BOOL) AS is_array, col_offset
        FROM ${schemaMetaTable},
        UNNEST(columns) col WITH OFFSET col_offset
        WHERE tablename = '${tableName}' AND databasename = '${postgresDatabase}'
          AND col.name NOT IN ('_cdc_op','_cdc_ts','_ingested_at')
      )
      SELECT AS STRUCT
        CONCAT(
          ' WITH winners AS (',
          '   SELECT',
          '     ${pkIdExpr} AS id,',
          '     ARRAY_AGG(message_id ORDER BY',
          '       SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) DESC,',
          '       IF(JSON_VALUE(data,\\'$.operation\\')=\\'DELETE\\',3,',
          '         IF(JSON_VALUE(data,\\'$.operation\\')=\\'UPDATE\\',2,1)) DESC',
          '       LIMIT 1)[OFFSET(0)] AS winning_message_id,',
          '     ARRAY_AGG(JSON_VALUE(data,\\'$.operation\\') ORDER BY',
          '       SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) DESC,',
          '       IF(JSON_VALUE(data,\\'$.operation\\')=\\'DELETE\\',3,',
          '         IF(JSON_VALUE(data,\\'$.operation\\')=\\'UPDATE\\',2,1)) DESC',
          '       LIMIT 1)[OFFSET(0)] AS action',
          '   FROM ${srcTable}',
          '   WHERE ${pkNotNullExpr}',
          '     AND publish_time > TIMESTAMP_SUB(TIMESTAMP(\\'@@CKPT@@\\'), INTERVAL ${lookbackHours} HOUR)',
          '   GROUP BY id',
          ' )',

          ' SELECT ',
          STRING_AGG(${colExprCase}, ', ' ORDER BY col_offset),
          ',   SAFE_CAST(JSON_VALUE(data,\\'$.sync_at\\') AS TIMESTAMP) AS sync_at',
          ',   publish_time AS publish_time',
          ',   CASE WHEN JSON_VALUE(JSON_QUERY(data,\\'$.after\\'),\\'$.${createdTime}\\') IS NOT NULL',
          '   THEN DATE(DATETIME(SAFE.PARSE_TIMESTAMP(\\'%Y-%m-%d %H:%M:%E*S%Ez\\',',
          '     JSON_VALUE(JSON_QUERY(data,\\'$.after\\'),\\'$.${createdTime}\\')),\\'${timezone}\\'))',
          '   ELSE DATE(\\'2099-01-01\\') END AS created_date',
          ',   w.action AS _cdc_action',
          ',   w.id     AS _cdc_pk',
          ' FROM (',
          '   SELECT * EXCEPT(_dup_rn) FROM (',
          '     SELECT *, ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY publish_time DESC) AS _dup_rn',
          '     FROM ${srcTable}',
          '     WHERE publish_time > TIMESTAMP_SUB(TIMESTAMP(\\'@@CKPT@@\\'), INTERVAL ${lookbackHours} HOUR)',
          '   ) WHERE _dup_rn = 1',
          ' ) r',
          ' JOIN winners w ON r.message_id = w.winning_message_id'
        ),
        STRING_AGG(CONCAT('\`', name, '\`'), ', ' ORDER BY col_offset),
        STRING_AGG(CONCAT('\`', name, '\` = S.\`', name, '\`'), ', ' ORDER BY col_offset),
        STRING_AGG(CONCAT('S.\`', name, '\`'), ', ' ORDER BY col_offset)
      FROM schema
    );

    -- ── 5. Nạp bảng STAGING (chạy 1 lần/ngày) ──────────────────────────────
    --   chưa tồn tại → CTAS (bỏ DELETE) ; đã tồn tại → MERGE
    IF NOT table_exists THEN
      SET dml_sql = CONCAT(
        'CREATE TABLE ${stgRef}',
        ' PARTITION BY created_date',
        ' CLUSTER BY ${clusterByExpr}',
        ' AS SELECT * EXCEPT(_cdc_action, _cdc_pk) FROM (',
        REPLACE(select_tpl, '@@CKPT@@', CAST(ingest_checkpoint AS STRING)),
        ')',
        ' WHERE _cdc_action != \\'DELETE\\''
      );
    ELSE
      SET dml_sql = CONCAT(
        'MERGE INTO ${stgRef} T',
        ' USING (', REPLACE(select_tpl, '@@CKPT@@', CAST(ingest_checkpoint AS STRING)), ') S',
        ' ON ${pkTargetExpr} = S._cdc_pk',
        ' WHEN MATCHED AND S._cdc_action = \\'DELETE\\' AND S.sync_at >= T.sync_at THEN DELETE',
        ' WHEN MATCHED AND S.sync_at > T.sync_at THEN UPDATE SET ', update_set, ', sync_at = S.sync_at, publish_time = S.publish_time',
        ' WHEN NOT MATCHED BY TARGET AND S._cdc_action != \\'DELETE\\' THEN',
        '   INSERT (', col_list, ', sync_at, publish_time, created_date)',
        '   VALUES (', insert_vals, ', S.sync_at, S.publish_time, S.created_date)'
      );
    END IF;

    EXECUTE IMMEDIATE dml_sql;

    -- ── 6. Checkpoint cho view: mốc publish_time mới nhất ĐÃ có trong stg ───
    --   Lấy sau khi nạp stg xong. View sẽ đọc raw từ mốc này (trừ lookback)
    --   nên chỉ scan phần delta phát sinh sau lần chạy hôm nay.
    SET view_checkpoint = (
      SELECT COALESCE(MAX(publish_time), TIMESTAMP('2000-01-01'))
      FROM ${stgRef}
    );

    -- ── 7. VIEW = stg (base) + delta mới nhất từ raw ────────────────────────
    --   - nhánh delta: cùng logic winners như MERGE, nhưng mốc = view_checkpoint
    --   - nhánh base : dữ liệu đang có trong stg, _cdc_action = 'BASE'
    --   - mỗi _cdc_pk giữ 1 dòng: ưu tiên sync_at mới nhất, nếu bằng nhau thì
    --     ưu tiên delta (_src = 1) — khớp semantics MERGE (S.sync_at >= T.sync_at)
    --   - dòng thắng mà là DELETE thì bị loại khỏi view (xoá logic)
    --   CREATE OR REPLACE mỗi lần chạy để view bắt kịp schema evolution.
    SET view_sql = CONCAT(
      'CREATE OR REPLACE VIEW ${viewRef} AS',
      ' WITH _cdc_union AS (',
      '   SELECT ', col_list, ', sync_at, publish_time, created_date,',
      '          _cdc_action, _cdc_pk, 1 AS _src',
      '   FROM (', REPLACE(select_tpl, '@@CKPT@@', CAST(view_checkpoint AS STRING)), ') d',
      '   UNION ALL',
      '   SELECT ', col_list, ', sync_at, publish_time, created_date,',
      '          \\'BASE\\' AS _cdc_action, ${pkTargetExpr} AS _cdc_pk, 0 AS _src',
      '   FROM ${stgRef} T',
      ' ), _cdc_ranked AS (',
      '   SELECT *, ROW_NUMBER() OVER (',
      '     PARTITION BY _cdc_pk ORDER BY sync_at DESC, _src DESC',
      '   ) AS _rn',
      '   FROM _cdc_union',
      ' )',
      ' SELECT * EXCEPT(_cdc_action, _cdc_pk, _src, _rn)',
      ' FROM _cdc_ranked',
      ' WHERE _rn = 1 AND _cdc_action != \\'DELETE\\''
    );

    EXECUTE IMMEDIATE view_sql;
  `;
}

module.exports = { generateCDCScript };