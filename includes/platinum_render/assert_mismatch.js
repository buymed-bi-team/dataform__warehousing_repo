function assertMismatch_query({
  config,
  ctx,
  assertionName,
  dependencyViewName,
  maxRetry,
}) {
  const query = `
  DECLARE is_assert BOOL;
  DECLARE _loop_index INT64;

  CREATE TEMP FUNCTION assert_condition()
  RETURNS BOOL
  AS ((
      WITH tbl AS (
          SELECT
              m.cnt mismatch_count,
              sf.value total_count
          FROM (
              SELECT COUNT(*) cnt
              FROM ${ctx.ref(config.customAssertionsSchema,dependencyViewName)}
              WHERE reason IN ( "MISSING_RECORDS" ,  "DELETED_RECORDS", "WRONG_UPDATE")
          ) m
          CROSS JOIN (
              SELECT
                  value
              FROM ${ctx.ref(config.customAssertionsSchema,dependencyViewName)}
              WHERE reason = "TOTAL COUNT"
          ) sf
      )
      SELECT
          ROUND( COALESCE(SAFE_DIVIDE( mismatch_count  * 100 , total_count ), 0 ))  >= 1
      FROM tbl
  ));

  SET is_assert = assert_condition();
  SET _loop_index = 0;
  WHILE
      _loop_index < ${maxRetry}
      AND is_assert = TRUE
  DO
      IF _loop_index > 0 THEN
          INSERT INTO ${source.log}
          (key, created_time, name, retry_index, extra_props, platform)
          (
              SELECT
                  GENERATE_UUID(),
                  CURRENT_TIMESTAMP(),
                  "${assertionName}",
                  _loop_index,
                  PARSE_JSON('{"dataset": "${config.target_schema}"}'),
                  "dataform"
          );
      END IF;

      CREATE OR REPLACE TABLE ${ctx.ref(config.target_schema,config.tableName)}
      PARTITION BY created_date
      AS (
          WITH over_tbl AS (
              SELECT
                  mg_id,
                  ARRAY_AGG(
                    key 
                    ORDER BY
                      synced_at DESC,
                      IF (action='d',3, IF (action='u',2,1)) DESC,
                      ${config.lastUpdatedTime} DESC
                    LIMIT 1
                  )[0] key ,
                   ARRAY_AGG(
                    action 
                    ORDER BY
                      synced_at DESC,
                      IF (action='d',3, IF (action='u',2,1)) DESC,
                      ${config.lastUpdatedTime} DESC
                    LIMIT 1
                  )[0] action
              FROM ${config.source_schema}.${config.tableName} 
              GROUP BY mg_id HAVING action != "d"
          )
          SELECT
              *,
              CASE
                  WHEN ${config.createdTime} IS NOT NULL THEN DATE(DATETIME(${config.createdTime},'Asia/Ho_Chi_Minh'))
                  ELSE "2099-01-01"
              END AS created_date,
              CURRENT_DATETIME() AS platinum_refresh
          FROM
          ${config.source_schema}.${config.tableName} s
          WHERE key IN (SELECT o.key FROM over_tbl o )
      );

      SET is_assert = assert_condition();
      SET _loop_index = _loop_index + 1;
  END WHILE;

  IF is_assert = TRUE THEN
      INSERT INTO ${source.log}
          (key, created_time, name, retry_index, extra_props, platform)
          (
              SELECT
                  GENERATE_UUID(),
                  CURRENT_TIMESTAMP(),
                  "${assertionName}",
                  _loop_index,
                  PARSE_JSON('{"dataset": "${config.target_schema}", "level":"CRITICAL"}'),
                  "dataform"
          );
      ASSERT FALSE AS "${config.tableName} is still have mismatch records";
  END IF;
  `;

  return query;
}

function assertMismatch({
  config,
  tags,
  assertionName ,
  dependencyViewName,
  dependencies ,
  bigquery = {},
  disabled = false,
  maxRetry = 2,
}) {
  assertionName = assertionName || `${config.prefixCustomAssertionsName}${config.tableName}__assert_mismatch_operations`
  dependencyViewName = dependencyViewName || `${config.prefixCustomAssertionsName}${config.tableName}__assert_mismatch_view`
  dependencies = dependencies || [{schema:config.customAssertionsSchema,name:dependencyViewName}]
  return operate(
    assertionName
  ).description(
    `Assertion operations - Data Completeness Assurance for ${config.tableName}`
  ).tags(
    tags
  ).schema(
    config.customAssertionsSchema
  ).dependencies(
    dependencies
  ).config({
    disabled
  }).queries(
    ctx => assertMismatch_query({
      config,
      ctx,
      assertionName,
      dependencyViewName,
      maxRetry,
  }));
}

module.exports = { assertMismatch };
