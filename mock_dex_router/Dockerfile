FROM rust:slim

RUN USER=root cargo new --bin mock_dex_router
WORKDIR /mock_dex_router

COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml

RUN cargo build --release
RUN rm src/*.rs

COPY ./src ./src

RUN cargo clean
RUN cargo install --path .

ENV REDIS_URL=redis://redis:6379

CMD ["./target/release/order_execution_engine"]