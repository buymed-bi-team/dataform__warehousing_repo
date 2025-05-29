// definitions/seller_prd_purchasing_purchase_order_assert.js

function assertUnique_query({
    config,
    ctx,
    intervalCheckpoint = ``, // example intervalCheckpoint = `INTERVAL 1 MONTH` // For mkp_order_item
    maxRetry = 2,
}) {
  let assertCondition = ``
  if (intervalCheckpoint == ``) {
    assertCondition = `
    SET duplicate = ARRAY(
        SELECT DISTINCT mg_id
        FROM ${ctx.ref(`${config.target_schema}`,`${config.tableName}`)}
        GROUP BY mg_id HAVING COUNT(1) > 1
    );
    SET is_assert = (SELECT ARRAY_LENGTH(duplicate) != 0);
    `
  } else {
    assertCondition = `
    BEGIN
        CALL ${config.target_schema}.unique_assertion(
            "${config.tableName}",
            ${config.createdTime === "created_time" ? `TRUE` : `FALSE`},
            DATE_SUB(CURRENT_DATE(), ${intervalCheckpoint}),
            duplicate
        );
    END ;
    SET is_assert = (SELECT ARRAY_LENGTH(duplicate) != 0);
    `
  }

  const query_script = `
  DECLARE is_assert BOOL;
  DECLARE _loop_index INT64;
  DECLARE keys ARRAY<STRING>;
  DECLARE dates ARRAY<DATE>;
  DECLARE duplicate ARRAY <STRING> ;

  ${assertCondition}
  SET _loop_index = 0;

  WHILE is_assert = TRUE AND _loop_index < ${maxRetry} DO
    INSERT INTO ${source.log}
      (key, created_time, name, retry_index, extra_props, platform)
    VALUES
      (
        GENERATE_UUID(), 
        CURRENT_TIMESTAMP(), 
        "${config.tableName}__assert_unique", 
        _loop_index, 
        PARSE_JSON('{"dataset": "${config.target_schema}","duplicate": ' || TO_JSON_STRING(duplicate) || '}'), 
        "dataform"
      );

    CREATE TEMP TABLE deleted_records AS (
      SELECT key, created_date
      FROM (
        SELECT key, mg_id, synced_at, action, created_date
        FROM ${ctx.ref(config.target_schema,config.tableName)}
        QUALIFY ROW_NUMBER() OVER (PARTITION BY mg_id ORDER BY synced_at DESC, IF(action = "u", 2, 1) DESC) != 1
      )
    );

    SET keys = (SELECT ARRAY_AGG(key) FROM deleted_records);
    SET dates = (SELECT ARRAY_AGG(created_date) FROM deleted_records);

    DELETE FROM ${ctx.ref(config.target_schema,config.tableName)}
    WHERE key IN UNNEST(keys) AND created_date IN UNNEST(dates);

    ${assertCondition}
    SET _loop_index = _loop_index + 1;
  END WHILE;

  IF is_assert = TRUE THEN
    INSERT INTO ${source.log}
      (key, created_time, name, retry_index, extra_props, platform)
    VALUES
      (GENERATE_UUID(), CURRENT_TIMESTAMP(), "${config.tableName}__assert_unique", _loop_index, PARSE_JSON('{"dataset": "${config.target_schema}", "duplicate": '|| TO_JSON_STRING(duplicate) ||', "level":"CRITICAL"}'), "dataform");

    RAISE USING MESSAGE = "${config.tableName} is still duplicated";
  END IF;
  `
  return query_script;
}

function assertUnique({
    config,
    tags,
    assertionName = ``,
    dependencies = [],
    bigquery = {},
    disabled = false,
    intervalCheckpoint = ``, // example interval_dateRange = `INTERVAL 1 MONTH` // For mkp_order_item
    maxRetry = 2,
}) {
  assertionName = assertionName || `${config.prefixCustomAssertionsName}${config.tableName}__assert_unique`
  return operate(
    assertionName
  ).tags(
    tags
  ).schema(
    config.customAssertionsSchema
  ).dependencies(
    dependencies
  ).config({
    disabled
  }).queries(
    ctx => assertUnique_query({
      config,
      ctx,
      intervalCheckpoint,
      maxRetry,
    })
  );
}

module.exports = { assertUnique };
