// @generated automatically by Diesel CLI.

diesel::table! {
    orders (id) {
        id -> Int4,
        order_id -> Varchar,
        status -> Varchar,
        tx_hash -> Nullable<Varchar>,
        reason -> Nullable<Text>,
        execution_price -> Nullable<Numeric>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}
