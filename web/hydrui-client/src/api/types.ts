import { FileRelationship } from "@/constants/relationships";

import { ServiceType } from "../constants/services";

// Common response structure
export interface ApiResponse {
  version: number;
  hydrus_version: number;
}

// Service object types
export interface Service {
  name: string;
  type: ServiceType;
  type_pretty: string;
  service_key?: string;
  star_shape?: "circle" | "fat star";
  min_stars?: number;
  max_stars?: number;
}

export interface ServicesObject {
  [service_key: string]: Service;
}

export interface ServicesResponse extends ApiResponse {
  services: Record<string, Service>;
}

// File identifier data
export interface FileIdentifier {
  file_id: number;
  hash: string;
}

// File metadata types
export interface FileMetadata {
  file_id: number;
  hash: string;
  size?: number;
  mime?: string;
  width?: number;
  height?: number;
  duration?: number | null;
  has_audio?: boolean;
  thumbnail_width?: number;
  thumbnail_height?: number;
  is_inbox?: boolean;
  is_local?: boolean;
  is_trashed?: boolean;
  is_deleted?: boolean;
  known_urls?: string[];
  tags?: {
    [service_key: string]: {
      storage_tags: {
        [status: string]: string[];
      };
      display_tags: {
        [status: string]: string[];
      };
    };
  };
  ratings?: {
    [service_key: string]: boolean | number | null;
  };
  notes?: {
    [name: string]: string;
  };
}

// Search response
export interface SearchFilesResponse extends ApiResponse {
  file_ids: number[];
  hashes?: string[];
}

// File metadata response
export interface FileMetadataResponse extends ApiResponse {
  services: ServicesObject;
  metadata: FileMetadata[];
}

// File metadata identifier-only response
export interface FileIdentifiersResponse extends ApiResponse {
  services: ServicesObject;
  metadata: FileIdentifier[];
}

// Page types
export interface Page {
  name: string;
  page_key: string;
  page_state: number;
  page_type: number;
  is_media_page: boolean;
  selected: boolean;
  pages?: Page[];
}

export interface PageResponse extends ApiResponse {
  pages: Page;
}

// Page info response - this would contain information about files in a page
export interface PageInfoResponse extends ApiResponse {
  page_info: {
    name: string;
    page_key: string;
    page_state: number;
    page_type: number;
    is_media_page: boolean;
    management?: Record<string, unknown>;
    media?: {
      num_files: number;
      hash_ids: number[];
    };
  };
}

// Add file response
export interface AddFileResponse extends ApiResponse {
  status: number;
  hash: string;
  note: string;
  traceback?: string;
}

// Add files request
export interface AddFilesRequest {
  file_ids?: number[];
  hashes?: string[];
  page_key: string;
}

// Tag types
export interface TagsResponse extends ApiResponse {
  tags: {
    value: string;
    count: number;
  }[];
}

// URL types
export interface AssociateUrlRequest {
  file_ids?: number[];
  hashes?: string[];
  urls_to_add: string[];
  urls_to_delete: string[];
  normalise_urls: boolean;
}

// Popup types
export interface JobStatus {
  key: string;
  creation_time: number;
  had_error: boolean;
  is_cancellable: boolean;
  is_cancelled: boolean;
  is_done: boolean;
  is_pausable: boolean;
  is_paused: boolean;
  nice_string: string;
  attached_files_mergable?: boolean;
  files?: {
    hashes: string[];
    label?: string;
  };
}

export interface PopupsResponse extends ApiResponse {
  job_statuses: JobStatus[];
}

// Tag update types
export interface TagUpdate {
  [action: number]: string[];
}

export interface TagUpdates {
  [serviceKey: string]: TagUpdate;
}

export interface AddTagsRequest {
  hash: string;
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

export interface AddUrlResponse extends ApiResponse {
  human_result_text: string;
  normalised_url: string;
}

export interface FileRelationshipPair {
  hash_a: string;
  hash_b: string;
  relationship: FileRelationship;
  do_default_content_merge: boolean;
  delete_a?: boolean;
  delete_b?: boolean;
}

export interface SetFileRelationshipsRequest {
  relationships: FileRelationshipPair[];
}

export interface SetKingsRequest {
  file_ids: number[];
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

export interface AddNotesResponse {
  notes: Record<string, string>;
}

export interface DeleteNotesRequest {
  note_names: string[];
  hash?: string;
  file_id?: number;
}

// API client interface
export interface HydrusApiClient {
  // Authentication
  verifyAccessKey: (apiKey: string) => Promise<boolean>;

  // Services
  getServices: () => Promise<ServicesResponse>;
  getService: (serviceKey: string) => Promise<Service>;

  // Search
  searchFiles: (
    tags: string[],
    fileServiceKey?: string,
    signal?: AbortSignal,
  ) => Promise<SearchFilesResponse>;
  getFileMetadata: (
    fileIds: number[],
    signal?: AbortSignal,
  ) => Promise<FileMetadataResponse>;
  getFileIdsByHashes: (
    hashes: string[],
    signal?: AbortSignal,
  ) => Promise<FileIdentifiersResponse>;
  getFileMetadataByHashes: (
    hashes: string[],
    signal?: AbortSignal,
  ) => Promise<FileMetadataResponse>;

  // File operations
  getFileUrl: (fileId: number) => string;
  getThumbnailUrl: (fileId: number) => string;

  // Rating operations
  setRating: (
    fileId: number,
    serviceKey: string,
    rating: boolean | number | null,
  ) => Promise<void>;

  // Tag operations
  searchTags: (
    search: string,
    serviceKey?: string,
    signal?: AbortSignal,
  ) => Promise<TagsResponse>;
  editTags: (fileIds: number[], updates: TagUpdates) => Promise<void>;

  // Page operations
  getPages: () => Promise<PageResponse>;
  getPageInfo: (pageKey: string) => Promise<PageInfoResponse>;
  addFiles: (request: AddFilesRequest) => Promise<void>;
  refreshPage: (pageKey: string) => Promise<void>;

  // Popup operations
  getPopups: () => Promise<PopupsResponse>;
  dismissPopup: (jobKey: string) => Promise<void>;

  // Upload file operation
  uploadFile: (
    file: File,
    progressCallback?: (progress: number) => void,
    signal?: AbortSignal,
  ) => Promise<AddFileResponse>;

  // URL operations
  addUrl: (request: AddUrlRequest) => Promise<AddUrlResponse>;
  associateUrl: (request: AssociateUrlRequest) => Promise<void>;

  // File relationship operations
  setFileRelationships: (request: SetFileRelationshipsRequest) => Promise<void>;
  setKings: (fileIds: number[]) => Promise<void>;

  // Note operations
  addNotes: (request: AddNotesRequest) => Promise<AddNotesResponse>;
  deleteNotes: (request: DeleteNotesRequest) => Promise<void>;
}
