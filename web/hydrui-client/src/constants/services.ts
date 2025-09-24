export enum ServiceType {
  TAG_REPOSITORY = 0,
  FILE_REPOSITORY = 1,
  LOCAL_FILE_DOMAIN = 2,
  MESSAGE_DEPOT = 3,
  LOCAL_TAG = 5,
  LOCAL_RATING_NUMERICAL = 6,
  LOCAL_RATING_LIKE = 7,
  RATING_NUMERICAL_REPOSITORY = 8,
  RATING_LIKE_REPOSITORY = 9,
  COMBINED_TAG = 10,
  COMBINED_FILE = 11,
  LOCAL_BOORU = 12,
  IPFS = 13,
  LOCAL_FILE_TRASH_DOMAIN = 14,
  COMBINED_LOCAL_FILE = 15,
  TEST_SERVICE = 16,
  LOCAL_NOTES = 17,
  CLIENT_API_SERVICE = 18,
  COMBINED_DELETED_FILE = 19,
  LOCAL_FILE_UPDATE_DOMAIN = 20,
  COMBINED_LOCAL_MEDIA = 21,
  LOCAL_RATING_INCDEC = 22,
  SERVER_ADMIN = 99,
  NULL_SERVICE = 100,
}

export const SERVICE_STRINGS: Record<ServiceType, string> = {
  [ServiceType.TAG_REPOSITORY]: "hydrus tag repository",
  [ServiceType.FILE_REPOSITORY]: "hydrus file repository",
  [ServiceType.LOCAL_FILE_DOMAIN]: "local file domain",
  [ServiceType.LOCAL_FILE_TRASH_DOMAIN]: "local trash file domain",
  [ServiceType.LOCAL_FILE_UPDATE_DOMAIN]: "local update file domain",
  [ServiceType.COMBINED_LOCAL_FILE]: "virtual combined local file service",
  [ServiceType.COMBINED_LOCAL_MEDIA]: "virtual combined local media service",
  [ServiceType.MESSAGE_DEPOT]: "hydrus message depot",
  [ServiceType.LOCAL_TAG]: "local tag service",
  [ServiceType.LOCAL_RATING_INCDEC]: "local inc/dec rating service",
  [ServiceType.LOCAL_RATING_NUMERICAL]: "local numerical rating service",
  [ServiceType.LOCAL_RATING_LIKE]: "local like/dislike rating service",
  [ServiceType.RATING_NUMERICAL_REPOSITORY]:
    "hydrus numerical rating repository",
  [ServiceType.RATING_LIKE_REPOSITORY]: "hydrus like/dislike rating repository",
  [ServiceType.COMBINED_TAG]: "virtual combined tag service",
  [ServiceType.COMBINED_FILE]: "virtual combined file service",
  [ServiceType.LOCAL_BOORU]: "client local booru",
  [ServiceType.CLIENT_API_SERVICE]: "client api",
  [ServiceType.IPFS]: "ipfs daemon",
  [ServiceType.TEST_SERVICE]: "test service",
  [ServiceType.LOCAL_NOTES]: "local file notes service",
  [ServiceType.SERVER_ADMIN]: "hydrus server administration service",
  [ServiceType.COMBINED_DELETED_FILE]: "virtual deleted file service",
  [ServiceType.NULL_SERVICE]: "null service",
};

export const SPECIFIC_LOCAL_FILE_SERVICES = new Set([
  ServiceType.LOCAL_FILE_DOMAIN,
  ServiceType.LOCAL_FILE_UPDATE_DOMAIN,
  ServiceType.LOCAL_FILE_TRASH_DOMAIN,
]);

export const LOCAL_FILE_SERVICES = new Set([
  ...SPECIFIC_LOCAL_FILE_SERVICES,
  ServiceType.COMBINED_LOCAL_FILE,
  ServiceType.COMBINED_LOCAL_MEDIA,
]);

export const LOCAL_FILE_SERVICES_IN_NICE_ORDER = [
  ServiceType.LOCAL_FILE_DOMAIN,
  ServiceType.COMBINED_LOCAL_MEDIA,
  ServiceType.LOCAL_FILE_TRASH_DOMAIN,
  ServiceType.LOCAL_FILE_UPDATE_DOMAIN,
  ServiceType.COMBINED_LOCAL_FILE,
];

export const LOCAL_TAG_SERVICES = new Set([ServiceType.LOCAL_TAG]);

export const LOCAL_SERVICES = new Set([
  ...LOCAL_FILE_SERVICES,
  ...LOCAL_TAG_SERVICES,
  ServiceType.LOCAL_RATING_LIKE,
  ServiceType.LOCAL_RATING_NUMERICAL,
  ServiceType.LOCAL_RATING_INCDEC,
  ServiceType.LOCAL_NOTES,
  ServiceType.CLIENT_API_SERVICE,
]);

export const STAR_RATINGS_SERVICES = new Set([
  ServiceType.LOCAL_RATING_LIKE,
  ServiceType.LOCAL_RATING_NUMERICAL,
  ServiceType.RATING_LIKE_REPOSITORY,
  ServiceType.RATING_NUMERICAL_REPOSITORY,
]);

export const RATINGS_SERVICES = new Set([
  ServiceType.LOCAL_RATING_LIKE,
  ServiceType.LOCAL_RATING_NUMERICAL,
  ServiceType.LOCAL_RATING_INCDEC,
  ServiceType.RATING_LIKE_REPOSITORY,
  ServiceType.RATING_NUMERICAL_REPOSITORY,
]);

export const REPOSITORIES = new Set([
  ServiceType.TAG_REPOSITORY,
  ServiceType.FILE_REPOSITORY,
  ServiceType.RATING_LIKE_REPOSITORY,
  ServiceType.RATING_NUMERICAL_REPOSITORY,
]);

export const RESTRICTED_SERVICES = new Set([
  ...REPOSITORIES,
  ServiceType.SERVER_ADMIN,
  ServiceType.MESSAGE_DEPOT,
]);

export const REMOTE_SERVICES = new Set([
  ...RESTRICTED_SERVICES,
  ServiceType.IPFS,
]);

export const REMOTE_FILE_SERVICES = new Set([
  ServiceType.FILE_REPOSITORY,
  ServiceType.IPFS,
]);

export const REAL_FILE_SERVICES = new Set([
  ...LOCAL_FILE_SERVICES,
  ServiceType.COMBINED_DELETED_FILE,
  ...REMOTE_FILE_SERVICES,
]);

export const REAL_TAG_SERVICES = new Set([
  ServiceType.LOCAL_TAG,
  ServiceType.TAG_REPOSITORY,
]);

export const ADDREMOVABLE_SERVICES = new Set([
  ServiceType.LOCAL_TAG,
  ServiceType.LOCAL_FILE_DOMAIN,
  ServiceType.LOCAL_RATING_LIKE,
  ServiceType.LOCAL_RATING_NUMERICAL,
  ServiceType.LOCAL_RATING_INCDEC,
  ServiceType.FILE_REPOSITORY,
  ServiceType.TAG_REPOSITORY,
  ServiceType.SERVER_ADMIN,
  ServiceType.IPFS,
]);
