import * as z from "zod/mini";

import { HydrusFileType } from "@/constants/filetypes";
import { FileRelationship } from "@/constants/relationships";
import { SortFilesBy } from "@/constants/sort";

import { ServiceType } from "../constants/services";

function unknownValue<T>(field: string, def: T) {
  return (ctx: z.core.$ZodCatchCtx) => {
    console.warn(
      `warning: unknown value ${JSON.stringify(ctx.value)} for ${field}`,
    );
    return def;
  };
}
// Common response structure
export const ApiResponseSchema = z.looseObject({
  version: z.number(),
  hydrus_version: z.number(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// Service object types
export const ServiceSchema = z.looseObject({
  name: z.string(),
  type: z.catch(
    z.enum(ServiceType),
    unknownValue("service.type", ServiceType.NULL_SERVICE),
  ),
  type_pretty: z.string(),
  service_key: z.optional(z.string()),
  star_shape: z.catch(
    z.optional(z.enum(["circle", "fat star"])),
    unknownValue("service.star_shape", undefined),
  ),
  min_stars: z.optional(z.number()),
  max_stars: z.optional(z.number()),
});

export type Service = z.infer<typeof ServiceSchema>;

export const ServicesObjectSchema = z.record(z.string(), ServiceSchema);

export type ServicesObject = z.infer<typeof ServicesObjectSchema>;

export const ServicesResponseSchema = z.extend(ApiResponseSchema, {
  services: z.record(z.string(), ServiceSchema),
});

export type ServicesResponse = z.infer<typeof ServicesResponseSchema>;

// File identifier data
export const FileIdentifierSchema = z.looseObject({
  file_id: z.number(),
  hash: z.string(),
});

export type FileIdentifier = z.infer<typeof FileIdentifierSchema>;

// File metadata types
export const FileMetadataSchema = z.looseObject({
  file_id: z.number(),
  hash: z.string(),
  size: z.optional(z.number()),
  mime: z.optional(z.string()),
  filetype_enum: z.catch(
    z.optional(z.enum(HydrusFileType)),
    unknownValue("filetype_enum", undefined),
  ),
  width: z.optional(z.nullable(z.number())),
  height: z.optional(z.nullable(z.number())),
  duration: z.optional(z.nullable(z.number())),
  num_frames: z.optional(z.nullable(z.number())),
  has_audio: z.optional(z.nullable(z.boolean())),
  thumbnail_width: z.optional(z.number()),
  thumbnail_height: z.optional(z.number()),
  is_inbox: z.optional(z.boolean()),
  is_local: z.optional(z.boolean()),
  is_trashed: z.optional(z.boolean()),
  is_deleted: z.optional(z.boolean()),
  time_modified: z.optional(z.number()),
  known_urls: z.catch(
    z.optional(z.array(z.string())),
    unknownValue("known_urls", undefined),
  ),
  tags: z.optional(
    z.record(
      z.string(),
      z.looseObject({
        storage_tags: z.record(z.string(), z.array(z.string())),
        display_tags: z.record(z.string(), z.array(z.string())),
      }),
    ),
  ),
  ratings: z.optional(
    z.record(
      z.string(),
      z.catch(
        z.union([z.boolean(), z.number(), z.null()]),
        unknownValue("metadata.ratings[]", null),
      ),
    ),
  ),
  notes: z.optional(z.record(z.string(), z.string())),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

export interface FileDomainParam {
  file_service_key?: string;
  file_service_keys?: string[];
  deleted_file_service_key?: string;
  deleted_file_service_keys?: string[];
}

export interface FilesParam {
  file_id?: number | undefined;
  file_ids?: number[] | undefined;
  hash?: string | undefined;
  hashes?: string[] | undefined;
}

// Search params
export interface SearchFilesParams extends FileDomainParam {
  tags: string[];
  tag_service_key?: string;
  include_current_tags?: boolean;
  include_pending_tags?: boolean;
  file_sort_type?: SortFilesBy;
  file_sort_asc?: boolean;
  return_file_ids?: boolean;
  return_hashes?: boolean;
}

// Search response
export const SearchFilesResponseSchema = z.extend(ApiResponseSchema, {
  file_ids: z.array(z.number()),
  hashes: z.optional(z.array(z.string())),
});

export type SearchFilesResponse = z.infer<typeof SearchFilesResponseSchema>;

// File metadata params
export interface FileMetadataParams extends FilesParam {
  create_new_file_ids?: boolean;
  only_return_identifiers?: boolean;
  only_return_basic_information?: boolean;
  detailed_url_information?: boolean;
  include_blurhash?: boolean;
  include_milliseconds?: boolean;
  include_notes?: boolean;
  include_services_object?: boolean;
}

// File metadata response
export const FileMetadataResponseSchema = z.extend(ApiResponseSchema, {
  services: z.optional(ServicesObjectSchema),
  metadata: z.array(FileMetadataSchema),
});

export type FileMetadataResponse = z.infer<typeof FileMetadataResponseSchema>;

// File metadata identifier-only response
export const FileIdentifiersResponseSchema = z.extend(ApiResponseSchema, {
  services: ServicesObjectSchema,
  metadata: z.array(FileIdentifierSchema),
});

export type FileIdentifiersResponse = z.infer<
  typeof FileIdentifiersResponseSchema
>;

// Page types
export const PageSchema = z.looseObject({
  name: z.string(),
  page_key: z.string(),
  page_state: z.catch(
    z.optional(z.number()),
    unknownValue("page.page_state", undefined),
  ),
  page_type: z.catch(
    z.optional(z.number()),
    unknownValue("page.page_type", undefined),
  ),
  is_media_page: z.catch(
    z.optional(z.boolean()),
    unknownValue("page.is_media_page", undefined),
  ),
  selected: z.catch(
    z.optional(z.boolean()),
    unknownValue("page.selected", undefined),
  ),
  get pages() {
    return z.optional(z.array(PageSchema));
  },
});

export type Page = z.infer<typeof PageSchema>;

export const PageResponseSchema = z.extend(ApiResponseSchema, {
  pages: PageSchema,
});

export type PageResponse = z.infer<typeof PageResponseSchema>;

export interface PageInfoParams {
  page_key: string;
  simple?: boolean;
}

// Page info response - this would contain information about files in a page
export const PageInfoResponseSchema = z.extend(ApiResponseSchema, {
  page_info: z.looseObject({
    name: z.string(),
    page_key: z.string(),
    page_state: z.number(),
    page_type: z.number(),
    is_media_page: z.boolean(),
    management: z.optional(z.record(z.string(), z.unknown())),
    media: z.optional(
      z.looseObject({
        num_files: z.number(),
        hash_ids: z.array(z.number()),
      }),
    ),
  }),
});

export type PageInfoResponse = z.infer<typeof PageInfoResponseSchema>;

// Add file response
export const AddFileResponseSchema = z.extend(ApiResponseSchema, {
  status: z.number(),
  hash: z.string(),
  note: z.string(),
  traceback: z.optional(z.string()),
});

export type AddFileResponse = z.infer<typeof AddFileResponseSchema>;

// Add files request
export interface AddFilesRequest {
  file_ids?: number[];
  hashes?: string[];
  page_key: string;
}

// Refresh page request
export interface RefreshPageRequest {
  page_key: string;
}

// Tag search params
export interface TagsSearchParams extends FileDomainParam {
  search?: string;
  tag_service_key?: string;
  tag_display_type?: string;
}

// Tag types
export const TagsResponseSchema = z.extend(ApiResponseSchema, {
  tags: z.array(
    z.looseObject({
      value: z.string(),
      count: z.number(),
    }),
  ),
});

export type TagsResponse = z.infer<typeof TagsResponseSchema>;

// URL types
export interface AssociateUrlRequest {
  file_ids?: number[];
  hashes?: string[];
  urls_to_add: string[];
  urls_to_delete: string[];
  normalise_urls: boolean;
}

// Popup types
export const JobStatusSchema = z.looseObject({
  key: z.string(),
  creation_time: z.catch(z.number(), unknownValue("job.creation_time", 0)),
  had_error: z.optional(z.boolean()),
  is_cancellable: z.optional(z.boolean()),
  is_cancelled: z.optional(z.boolean()),
  is_done: z.optional(z.boolean()),
  is_pausable: z.optional(z.boolean()),
  is_paused: z.optional(z.boolean()),
  nice_string: z.optional(z.string()),
  attached_files_mergable: z.optional(z.boolean()),
  files: z.optional(
    z.looseObject({
      hashes: z.array(z.string()),
      label: z.optional(z.string()),
    }),
  ),
});

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const PopupsResponseSchema = z.extend(ApiResponseSchema, {
  job_statuses: z.array(JobStatusSchema),
});

export type PopupsResponse = z.infer<typeof PopupsResponseSchema>;

export interface DismissPopupRequest {
  job_status_key: string;
}

// Tag update types
export interface TagUpdate {
  [action: number]: string[];
}

export interface TagUpdates {
  [serviceKey: string]: TagUpdate;
}

export interface AddTagsRequest extends FilesParam {
  service_keys_to_actions_to_tags: TagUpdates;
  service_keys_to_tags?: Record<string, string[]>;
}

// Add URL import types
export interface AddUrlRequest {
  url: string;
  destination_page_key?: string;
  destination_page_name?: string;
  show_destination_page?: boolean;
  service_keys_to_additional_tags?: Record<string, string[]>;
}

export const AddUrlResponseSchema = z.extend(ApiResponseSchema, {
  human_result_text: z.string(),
  normalised_url: z.string(),
});

export type AddUrlResponse = z.infer<typeof AddUrlResponseSchema>;

export interface FileRelationshipPair {
  hash_a: string;
  hash_b: string;
  relationship: FileRelationship;
  do_default_content_merge: boolean;
  delete_a?: boolean;
  delete_b?: boolean;
}

export type GetFileRelationshipsParams = FilesParam;

export const GetFileRelationshipsResponseSchema = z.looseObject({
  file_relationships: z.record(
    z.string(),
    z.looseObject({
      is_king: z.boolean(),
      king: z.string(),
      king_is_on_file_domain: z.catch(
        z.boolean(),
        unknownValue("file_relationships.king_is_on_file_domain", true),
      ),
      king_is_local: z.catch(
        z.boolean(),
        unknownValue("file_relationships.king_is_local", true),
      ),
    }),
  ),
});

export type GetFileRelationshipsResponse = z.infer<
  typeof GetFileRelationshipsResponseSchema
>;

export interface SetFileRelationshipsRequest {
  relationships: FileRelationshipPair[];
}

export type SetKingsRequest = FilesParam;

// Ratings
export interface SetRatingRequest extends FilesParam {
  rating_service_key: string;
  rating: boolean | number | null;
}

// Notes
export interface AddNotesRequest {
  notes: Record<string, string>;
  hash?: string;
  file_id?: number;
  merge_cleverly?: boolean;
  extend_existing_note_if_possible?: boolean;
  conflict_resolution?: number;
}

export const AddNotesResponseSchema = z.looseObject({
  notes: z.record(z.string(), z.string()),
});

export type AddNotesResponse = z.infer<typeof AddNotesResponseSchema>;

export interface DeleteNotesRequest {
  note_names: string[];
  hash?: string;
  file_id?: number;
}

export type ArchiveFilesRequest = FilesParam;

export type UnarchiveFilesRequest = FilesParam;

export interface DeleteFilesRequest extends FilesParam, FileDomainParam {}

export interface UndeleteFilesRequest extends FilesParam, FileDomainParam {}

export interface HttpRequestOptions {
  body?: Blob | string | null;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  method?: string;
  signal?: AbortSignal | null;
}

export interface HttpResponse {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType;
  readonly url: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  bytes(): Promise<Uint8Array>;
  formData(): Promise<FormData>;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface HttpClient {
  fetch(url: string, options: HttpRequestOptions): Promise<HttpResponse>;
}
