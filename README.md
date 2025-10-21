# Warehousing Repo For BI Core Team

## Useful Dataform CLI

1. Compile: `dataform compile --json > compiled_graph.json`
2. Run once as dry run: `dataform run --dry-run --actions <actions>`  
   This command will run without apply to bigquery table  
3. Execute to a table
   - `dataform run --actions <actions>`
   - `dataform run --tags <tags>`
