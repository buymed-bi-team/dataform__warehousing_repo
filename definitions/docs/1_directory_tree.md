# The File Tree

WorkSpace
    ├── gitignore
    ├── README.md
    ├── workflow_settings.yaml 
    │
    ├── includes
    │   └── <Javascript useful function>
    │
    └── definitions            // SQL model files
        ├── docs 
        │   └── <Dataform quickstart documents>
        │
        ├── data_quality      // SQL assertions files, this directory tree must same as models directory
        │    └── // # This is about how we name the file in this directory
        │        // - <model_name>_assertions.sqlx 
        |        // - <model_name>_unittest_<What is the mainly column did you test>.sqlx
        │
        ├── models            // The main model like dim table, fact table
        │    ├── intermediate // Where we store dimensional table
        │    │    └── < dimensional table will store in 5 question folder: what, who, where, when, why >
        │    │
        │    ├── mart         // Where we store fact table, we will store each data mart for each domain, operations
        │    │    ├── Inventory // you can create adhoc folder in it
        │    │    └── ...
        │    │
        │    └── staging         // Special case
        │         └── platinum   
        │
        └── raw_models        // For which table that you don't know where to place at that time, you can ask to brainstorm
