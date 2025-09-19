FROM rust:slim

RUN USER=root cargo new --bin backend
WORKDIR /backend

COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml

RUN cargo build --release
RUN rm src/*.rs

COPY ./src ./src

RUN cargo clean
RUN cargo install --path .

EXPOSE 3000
ENV REDIS_URL=redis://redis:6379

CMD ["./target/release/backend"]