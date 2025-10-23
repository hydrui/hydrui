FROM docker.io/library/node:alpine AS npmbuild
COPY . /work
WORKDIR /work
RUN npm ci && VITE_HYDRUI_VERSION=$(cat VERSION) npm run generate:pack

FROM docker.io/library/golang:1-alpine AS gobuild
COPY . /work
WORKDIR /work
COPY --from=npmbuild /work/internal/webdata/*.pack /work/internal/webdata
RUN go build -o /hydrui-server ./cmd/hydrui-server

FROM scratch
ENV HYDRUI_LISTEN_INTERNAL=:5050
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["/hydrui-server", "healthcheck", "http://localhost:5050/healthz?check_hydrus"]
COPY --from=gobuild /hydrui-server /hydrui-server
ENTRYPOINT ["/hydrui-server"]
