function createIncremental_preOps({
    config,
    ctx,
    has_src_created_date = false,
    ingestCutOffInterval = ``,
}) {
    let preOperation = ``;
    if (ingestCutOffInterval != ``) {
        ingestCutOffInterval = `WHERE created_date >= CURRENT_DATE() - ${ingestCutOffInterval}`
    }

    if (ctx.incremental()) {
        preOperation = `
        # Incremental
        DECLARE has_new_data BOOLEAN;
        DECLARE Ingest_checkpoint TIMESTAMP;
        DECLARE checkpoint_date ARRAY<date>;
        DECLARE deleted_records ARRAY<STRING>;

        SET Ingest_checkpoint = (
            SELECT max(ingest_time)  - INTERVAL 1 HOUR  FROM ${ctx.self()}
            ${ingestCutOffInterval}
        );
        IF Ingest_checkpoint IS NULL THEN 
            SET Ingest_checkpoint = (
                SELECT max(ingest_time)  - INTERVAL 1 HOUR  FROM ${ctx.self()}
            );
        END IF;

        SET ( has_new_data, checkpoint_date, deleted_records ) = (
            SELECT AS STRUCT
                IF (
                    COUNT(*) > 0 , TRUE, FALSE
                ) has_new_data,
                /*
                    has_new_data describe the existance of data after the last refresh time of platinum
                */
                ARRAY_AGG(
                    DISTINCT IF(${config.createdTime} is NULL, "2099-01-01" , DATE( DATETIME(${config.createdTime},'Asia/Ho_Chi_Minh') ) )
                ) AS checkpoint_date,
                ARRAY_AGG (
                    DISTINCT IF(action = 'd',mg_id, NULL) IGNORE NULLS
                ) AS deleted_records
            FROM ${config.source_schema}.${config.tableName}
            WHERE ingest_time > Ingest_checkpoint
        );

        CREATE TEMP TABLE new_records AS (
          SELECT DISTINCT mg_id
          FROM ${config.source_schema}.${config.tableName}
          WHERE ingest_time > Ingest_checkpoint
        );

        IF ( has_new_data = TRUE ) THEN
            IF (SELECT ARRAY_LENGTH(deleted_records) > 0) THEN
              SET checkpoint_date = ARRAY(
                SELECT DISTINCT created_date
                FROM ${ctx.self()}
                WHERE mg_id IN (SELECT mg_id FROM new_records)
              );
            END IF;

            DELETE FROM ${ctx.self()}
            WHERE
                created_date IN UNNEST(checkpoint_date)
                AND mg_id IN (SELECT mg_id FROM new_records)
            ;
        ELSE
            SET Ingest_checkpoint = TIMESTAMP("2099-01-01T00:00:00");
        END IF ;`
    }
    return preOperation
}
function createIncremental_query({
    config,
    ctx,
    has_src_created_date = false,
    ingestCutOffInterval = ``,
}) {
    const selectQuery = `
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
        ${ctx.incremental() ? `
        WHERE ingest_time > Ingest_checkpoint - INTERVAL 2 HOUR
        AND mg_id IN (SELECT n.mg_id FROM new_records n)
        ` : ""}
        GROUP BY mg_id HAVING action != "d"
    )
    SELECT
        * ${has_src_created_date ? `EXCEPT (created_date)` : `` },
        CASE
            WHEN ${config.createdTime} IS NOT NULL THEN DATE(DATETIME(${config.createdTime}, 'Asia/Ho_Chi_Minh'))
            ELSE DATE( '2099-01-01' )
        END AS created_date,
        CURRENT_DATETIME() AS platinum_refresh
    FROM ${config.source_schema}.${config.tableName}
    WHERE key IN (SELECT o.key FROM over_tbl o)
    ${ctx.incremental() ? `AND ingest_time > Ingest_checkpoint - INTERVAL 2 HOUR` : ""}

    QUALIFY ROW_NUMBER() OVER(w) = 1
    WINDOW w AS (
        PARTITION BY mg_id
        ORDER BY synced_at desc,
            synced_at DESC,
        IF (action='d',3, IF (action='u',2,1)) DESC,
        ${config.lastUpdatedTime} DESC
    )
    `
    return selectQuery;
}

function createIncremental({
    config, // read index
    tags,
    assertions = {},
    has_src_created_date = false,
    disabled = false,
    ingestCutOffInterval = ``,
}) {
    return publish(config.tableName, {
        type: "incremental",
        description: config.description,
        schema: config.target_schema,
        tags,
        assertions,
        disabled,
        protected: config.is_protected,
        bigquery: config.bigquery,
    }).preOps(
        ctx => createIncremental_preOps({
            config,
            ctx,
            has_src_created_date,
            ingestCutOffInterval,
        })
    ).query (
        ctx => createIncremental_query({
            config,
            ctx,
            has_src_created_date,
            ingestCutOffInterval,
        })
    )
}

module.exports = { createIncremental };

