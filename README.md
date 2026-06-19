# Dataform_Repo — Dataform Warehousing Project Overview

This is a data warehousing project built with **Dataform** for managing **BigQuery** data pipelines, maintained by the **BI Core Team**.

## Project Architecture

### Technology Stack

| Item              | Value                      |
| ----------------- | -------------------------- |
| Platform          | Google BigQuery (GCP)      |
| Orchestration     | Dataform (`v3.0.0-beta.6`) |
| Default Project   | `lakehouse-prod-394907`    |
| Default Dataset   | `gold_buymed_vn2`          |
| Region            | `asia-southeast1`          |
| Assertion Dataset | `dataform_assertions`      |

### Data Layer Structure (Medallion Architecture)

| Layer        | Datasets                                              | Mô tả                                         |
| ------------ | ----------------------------------------------------- | --------------------------------------------- |
| **Silver**   | `silver_buymed_vn`, `silver_buymed_vn_restricted`     | Raw / staging data                            |
| **Platinum** | `platinum_buymed_vn`, `platinum_buymed_vn_restricted` | Cleaned & deduplicated staging tables         |
| **Gold**     | `gold_buymed_vn`, `gold_buymed_vn2`                   | Business-ready dimensional / fact tables      |
| **Marts**    | folders under `definitions/models/marts/`             | Analytics-ready models (AI/ML, BI dashboards) |

Nguồn dữ liệu được khai báo tập trung trong `includes/source.js` (gồm `silver`, `silver_restricted`, `gold`, `ref`, `platinum`, `platinum_restricted`, `collector`, `circa`, `circa_os`, `external`, `log`).

## Repository Structure

```
Dataform_Repo/
└── dataform__warehousing_repo/      # Project Dataform chính
    ├── workflow_settings.yaml       # Cấu hình Dataform (project, dataset, location)
    ├── README.md                    # Hướng dẫn Dataform CLI cho team
    ├── includes/                    # Hàm/biến JavaScript dùng chung
    │   ├── main.js                  # Entry export (PlatinumModel)
    │   ├── platinum_render/         # Bộ render model "Platinum" (incremental, view, assertions)
    │   ├── datetime.js              # Tiện ích xử lý ngày/giờ
    │   ├── dedup.js                 # Logic deduplicate
    │   ├── source.js                # Khai báo nguồn dữ liệu
    │   ├── utils.js / cfunction.js / tfunction.js
    │   ├── query_segment.js
    │   ├── docs.js
    │   └── BuymedArrayVariables.js  # Biến mảng dùng chung
    │
    └── definitions/                 # Các file model SQLX
        ├── assign_tag.sqlx          # Init các tag chạy theo khung giờ (0h00 → 23h30)
        ├── docs/                    # Tài liệu quickstart & ví dụ mẫu
        ├── data_quality/            # Assertions / unit test (staging, intermediate, mart)
        ├── models/                  # Model chính
        │   ├── staging/             # Bao gồm "platinum"
        │   ├── intermediate/        # Dim table (chia theo what/who/where/when/why)
        │   └── marts/               # Fact table theo domain (Inventory, ...)
        └── raw_models/              # Model chưa phân loại / sandbox theo người (AI, KhanhNguyen, MinhLuu, ...)
```

Quy ước đặt tên trong `data_quality/`:

- `<model_name>_assertions.sqlx`
- `<model_name>_unittest_<column>.sqlx`

## Cấu hình mặc định

Trích từ `dataform__warehousing_repo/workflow_settings.yaml`:

| Thuộc tính                | Giá trị                 |
| ------------------------- | ----------------------- |
| `defaultProject`          | `lakehouse-prod-394907` |
| `defaultDataset`          | `gold_buymed_vn2`       |
| `defaultLocation`         | `asia-southeast1`       |
| `defaultAssertionDataset` | `dataform_assertions`   |
| `dataformCoreVersion`     | `3.0.0-beta.6`          |
| `vars.self_dedup`         | `N`                     |

## Dataform CLI thường dùng

Chạy các lệnh sau bên trong thư mục `dataform__warehousing_repo/`:

1. Compile graph:
   ```bash
   dataform compile --json > compiled_graph.json
   ```
2. Dry run (không apply lên BigQuery):
   ```bash
   dataform run --dry-run --actions <actions>
   ```
3. Thực thi:
   ```bash
   dataform run --actions <actions>
   dataform run --tags <tags>
   ```

Các tag theo khung giờ (`0h00`, `0h30`, ..., `23h30`) được khai báo trong `definitions/assign_tag.sqlx` để lập lịch chạy theo slot 30 phút.

## Key Features

### 1. Custom `PlatinumModel` Framework

JavaScript abstraction trong `includes/platinum_render/` chuẩn hoá việc tạo bảng với:

- **Incremental loading** với `ingestCutOffInterval` cấu hình được.
- **Partition tự động** theo `created_date`.
- **Built-in data quality assertions** (`assertUnique`, `assertMismatch`, `createMismatchAssertionView`).
- **Metadata chuẩn**: `has_lastUpdatedTime`, `has_createdTime` (mặc định `true`).
- **Deduplication** dùng window function.

API chính: `createIncremental(tags, opts)`, `assertUnique(tags, opts)`, `createMismatchAssertionView(tags, opts)`, `assertMismatch(tags, opts)`.

### 2. Data Sources

Pipeline ingest dữ liệu từ nhiều business domain:

| Domain             | Prefix bảng tiêu biểu                                          |
| ------------------ | -------------------------------------------------------------- |
| Accounting         | `platform_accounting_prd_reconcile_*`, `accounting_prd_core_*` |
| E-commerce         | `circa_online_prd_consumer_*`, `marketplace_prd_product_*`     |
| Product Management | `pim_prd_product_*`                                            |
| Customer Service   | `monitoring_prd_realtime_cs_*`                                 |
| Workflow           | `platform_organization_prd_workflow_*`                         |
| Analytics          | `platform_insider_prd_*` (notifications, popups)               |

### 3. Data Quality Framework

- Unique assertions với retry logic (`maxRetry: 2` mặc định).
- Interval-based validation (thường `INTERVAL 1 YEAR`, mismatch view mặc định `interval 2 DAY`).
- Mismatch assertion view cho data reconciliation.
- Dataset assertions riêng: `dataform_assertions`.

### 4. Scheduling Strategy

Model được gắn tag theo lịch chạy khác nhau:

- `platinum_0h00` / `platinum_00h00` — chạy lúc nửa đêm.
- `platinum_12h00` — chạy giữa trưa.
- `platinum_staging` — job staging tổng quát.

## Common Patterns

### Incremental Model Pattern

Sử dụng `PlatinumModel.createIncremental()` với `ingestCutOffInterval` để chỉ xử lý dữ liệu trong cửa sổ cấu hình, partition theo `created_date`.

### Deduplication Pattern

Dùng `QUALIFY ROW_NUMBER() OVER (_window) = 1` với thứ tự ưu tiên:

1. `synced_at DESC`
2. Action priority: **delete > update > insert**
3. `last_updated_time DESC`

## Analytics Use Cases

Layer `marts` phục vụ:

- **AI/ML**.
- **Product analytics** với categorization, pricing, inventory.
- **Customer behavior tracking** qua click analytics của notification / popup.
- ....

## Development Workflow

Đây là data warehouse production-grade với trọng tâm:

- **Data quality** (assertions tự động, mismatch view, retry).
- **Incremental processing** (cutoff interval, partition theo ngày).

## Tham khảo thêm

- `dataform__warehousing_repo/README.md` — Hướng dẫn CLI ngắn gọn cho team.
- `dataform__warehousing_repo/definitions/docs/` — Quickstart, ví dụ model thường / incremental, assertions, và mô tả cây thư mục.
- `dataform__warehousing_repo/includes/platinum_render/` — Source của `PlatinumModel` framework.
