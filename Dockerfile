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
COPY --from=gobuild /hydrui-server /hydrui-server
ENTRYPOINT ["/hydrui-server"]
