import { describe, expect, it } from "vitest";

import { FileMetadata, Service } from "@/api/types";
import { ServiceType } from "@/constants/services";

import { getFileDomains, getFileTimeImported } from "./fileMetadata";

const MOCK_SERVICES: Record<string, Service> = {
  "local-b": {
    name: "zeta local",
    type: ServiceType.LOCAL_FILE_DOMAIN,
    type_pretty: "local file domain",
  },
  "local-a": {
    name: "alpha local",
    type: ServiceType.LOCAL_FILE_DOMAIN,
    type_pretty: "local file domain",
  },
  trash: {
    name: "trash",
    type: ServiceType.LOCAL_FILE_TRASH_DOMAIN,
    type_pretty: "local trash file domain",
  },
  "repo-1": {
    name: "remote repo",
    type: ServiceType.FILE_REPOSITORY,
    type_pretty: "hydrus file repository",
  },
  "ipfs-1": {
    name: "ipfs node",
    type: ServiceType.IPFS,
    type_pretty: "ipfs daemon",
  },
  "all-local-media": {
    name: "all my files",
    type: ServiceType.COMBINED_LOCAL_MEDIA,
    type_pretty: "virtual combined local media service",
  },
  "all-local-files": {
    name: "all local files",
    type: ServiceType.COMBINED_LOCAL_FILE,
    type_pretty: "virtual combined local file service",
  },
  "local-tags": {
    name: "my tags",
    type: ServiceType.LOCAL_TAG,
    type_pretty: "local tag service",
  },
};

describe("getFileDomains", () => {
  it("excludes virtual and non-file services and lists local domains before remote", () => {
    const file: FileMetadata = {
      file_id: 1,
      hash: "h1",
      file_services: {
        current: {
          "ipfs-1": { time_imported: 500 },
          "all-local-media": { time_imported: 100 },
          "all-local-files": { time_imported: 100 },
          "local-tags": { time_imported: 100 },
          "unknown-key": { time_imported: 100 },
          "repo-1": { time_imported: null },
          trash: { time_imported: 300 },
          "local-b": { time_imported: 0 },
          "local-a": { time_imported: 150 },
        },
        deleted: {},
      },
    };

    const domains = getFileDomains(file, MOCK_SERVICES);
    expect(domains.map((d) => d.name)).toEqual([
      "alpha local",
      "trash",
      "zeta local",
      "ipfs node",
      "remote repo",
    ]);
    expect(domains[0]?.timeImported).toBe(150);
    expect(domains[2]?.timeImported).toBe(0);
    expect(domains[4]?.timeImported).toBeUndefined();
  });

  it("returns empty array when current services are absent", () => {
    expect(getFileDomains({ file_id: 1, hash: "h1" }, MOCK_SERVICES)).toEqual(
      [],
    );
  });
});

describe("getFileTimeImported", () => {
  it("prefers COMBINED_LOCAL_MEDIA when present", () => {
    expect(
      getFileTimeImported(
        {
          file_id: 1,
          hash: "h1",
          file_services: {
            current: {
              "local-a": { time_imported: 100 },
              "all-local-files": { time_imported: 200 },
              "all-local-media": { time_imported: 300 },
            },
            deleted: { "local-b": { time_imported: 50 } },
          },
        },
        MOCK_SERVICES,
      ),
    ).toBe(300);
  });

  it("falls back to COMBINED_LOCAL_FILE for trashed files", () => {
    expect(
      getFileTimeImported(
        {
          file_id: 1,
          hash: "h1",
          file_services: {
            current: {
              "all-local-files": { time_imported: 250 },
              trash: { time_imported: 900 },
            },
            deleted: {
              "local-a": { time_imported: 250, time_deleted: 900 },
              "all-local-media": { time_imported: 250, time_deleted: 900 },
            },
          },
        },
        MOCK_SERVICES,
      ),
    ).toBe(250);
  });

  it("falls back to earliest non-null current timestamp when combined services have none", () => {
    expect(
      getFileTimeImported(
        {
          file_id: 1,
          hash: "h1",
          file_services: {
            current: {
              "local-b": { time_imported: 400 },
              "local-a": { time_imported: 220 },
              "repo-1": { time_imported: null },
            },
            deleted: { trash: { time_imported: 100 } },
          },
        },
        MOCK_SERVICES,
      ),
    ).toBe(220);
  });

  it("falls back to earliest deleted timestamp when current has none", () => {
    expect(
      getFileTimeImported(
        {
          file_id: 1,
          hash: "h1",
          file_services: {
            current: { "all-local-media": { time_imported: null } },
            deleted: {
              "local-b": { time_imported: 500, time_deleted: 900 },
              "local-a": { time_imported: 350, time_deleted: 800 },
            },
          },
        },
        MOCK_SERVICES,
      ),
    ).toBe(350);
  });

  it("preserves epoch 0 timestamps and returns undefined when absent", () => {
    expect(
      getFileTimeImported(
        {
          file_id: 1,
          hash: "h1",
          file_services: {
            current: { "all-local-media": { time_imported: 0 } },
          },
        },
        MOCK_SERVICES,
      ),
    ).toBe(0);

    expect(
      getFileTimeImported({ file_id: 1, hash: "h1" }, MOCK_SERVICES),
    ).toBeUndefined();
  });
});
