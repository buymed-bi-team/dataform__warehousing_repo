config {
    type: "incremental",
    name: "dev_accounting_prd_invoice_order_invoice",
    schema: "platinum_buymed_vn",
    assertions: { // Will rewrite latter
         uniqueKey: 'mg_id'
     },
    bigquery: {
        partitionBy: "created_date"
    },
    tags: ["platinum_custom_1h_past7","warehouse_prd_inventory"]
}
/*
    # Dataform Platinum Incremental Model Explain:
    Idea: Insert newest data based on Ingest_time to platinum. 
    Requirement are you must create partition column, so that user can optimize these query. 
        Secondly, Query from silver must optimize to get the lowest cost.
        Thirdly, The Query must easy to read and review, and dataform can calculate cost, that means you can't use temporary table.
    
    Aditionally, there are many stituation when updated, there are:

        1. Insert new data:
            This is very easy, just insert. Nothing more

        2. Update old data:
            You can easy think that Update = Replace = Deleted Old + Insert New
            > So that equation equal
                - Delete Old One based on Created date of Platinum (requirement 3)
                - Then Insert Again 
        
        3. Delete data:
            This is not easy any more, because delete action record doesn't include created_time. So that you must join with Platinum but the recent version - the previous refresh version,
            to get created date. Then delete with the old data (update data)

        4. Update old data but data must be the previous refresh version
            This is because of streaming mechanism of data pipeline platform. Sometimes, data can be missing through pipeline because the network, so that streaming mechanism will return
            that data after 10 minutes. If there is one records, update at 8:00 am (event A) then update again at 8:05am (event B). Event A data is missing, Event B data is load without error
            Then the refresh time (Re_1) can completely update event B of that data, Next refresh time (Re_2) will update the previous data event means event A. Result, that data will only update
            1 time on platinum instead of 2.
            This stituation can be checked in silver that event records have same mg_id but can event record A's ingest_time > event record B's ingest_time, but synced_at or last_updated_time of A can lower

    To implement, I will declare some variables:
        has_new_data : whether event data are inserted after last refresh_time
        Ingest_checkpoint : Initially, this is the lastest ingest_time of Platinum, I use this checkpoint to check has_new_data. But if has_new_data = True, I will change it to previous 2 hour. 
            This is because of stituation 4
        checkpoint_date: is a list of distinct created_date of records, include new records, updated records, but not deleted records
        new_records: is a list mg_id of records can be new, updated or deleted one  
        has_deleted: whether new_records include deleted one
*/
pre_operations {
  ${
    when(incremental(),
        `
        # Incremental
        DECLARE has_new_data BOOLEAN;
        DECLARE Ingest_checkpoint TIMESTAMP;
        DECLARE checkpoint_date ARRAY<date>;
        DECLARE new_records ARRAY<STRING>;
        DECLARE has_deleted BOOLEAN;
        

        SET Ingest_checkpoint = (SELECT max(ingest_time) FROM ${self()});

        SET ( has_new_data, checkpoint_date, new_records, has_deleted ) = ( 
            SELECT AS STRUCT 
                IF ( 
                    COUNTIF(ingest_time > Ingest_checkpoint) > 0 , TRUE, FALSE 
                ) has_new_data,
                    /* 
                        has_new_data describe the existance of data after the last refresh time of platinum 
                    */
                ARRAY_AGG(
                    DISTINCT IF(created_time is NULL, "2099-01-01" , DATE( DATETIME(created_time,'Asia/Ho_Chi_Minh') ) )
                ) AS checkpoint_date,
                ARRAY_AGG (
                    DISTINCT mg_id IGNORE NULLS
                ) AS new_records,
                IF(
                    COUNTIF(action = 'd') > 0, TRUE, FALSE
                ) AS has_deleted
            FROM ${source.silver}.accounting_prd_invoice_order_invoice
            WHERE ingest_time > Ingest_checkpoint - INTERVAL 2 HOUR
        );

        IF ( has_new_data = TRUE ) THEN
            SET Ingest_checkpoint =  Ingest_checkpoint - INTERVAL 2 HOUR;

            IF ( has_deleted = TRUE ) THEN
                SET checkpoint_date = ARRAY (
                    SELECT DISTINCT created_date
                    FROM ${self()}
                    WHERE mg_id in UNNEST(new_records)
                );
            END IF;
        
            IF ( 
                SELECT ARRAY_LENGTH(new_records) > 0 
            ) THEN
                    DELETE FROM ${self()}
                    WHERE 
                        created_date IN UNNEST(checkpoint_date)
                        AND mg_id IN UNNEST(new_records)
                    ;
            END IF;
        END IF ;

        
      `,
      ``
    )
  }
}

--

SELECT
*,
CASE 
    WHEN created_time IS NOT NULL THEN DATE(DATETIME(created_time,'Asia/Ho_Chi_Minh'))
    ELSE "2099-01-01"
END AS created_date
FROM ${source.silver}.accounting_prd_invoice_order_invoice o 
${ when(incremental(), `WHERE ingest_time > Ingest_checkpoint `, `WHERE ingest_time > "2025-01-01" AND ingest_time <= "2025-01-22T13:00:00` )}

QUALIFY ROW_NUMBER() OVER (_window) = 1 AND FIRST_VALUE(action) OVER (_window) <> 'd'
WINDOW
_window AS (
PARTITION BY
    mg_id
ORDER BY
    synced_at DESC,
    IF
        (action='d',3,
        IF
        (action='u',2,1)) DESC,
        last_updated_time DESC)
