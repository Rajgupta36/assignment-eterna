FROM rust:slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN USER=root cargo new --bin db
WORKDIR /db

COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml
COPY ./migrations ./migrations
COPY ./diesel.toml ./diesel.toml

RUN cargo build --release
RUN rm src/*.rs

COPY ./src ./src

RUN cargo clean
RUN cargo install --path .

ENV DATABASE_URL=postgres://postgres:password@postgres:5432/order_db
ENV REDIS_URL=redis://redis:6379

CMD ["./target/release/db"]
