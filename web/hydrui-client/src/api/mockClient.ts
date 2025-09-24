import { ContentUpdateAction } from "../constants/contentUpdates";
import { ServiceType } from "../constants/services";
import {
  AddFileResponse,
  AddFilesRequest,
  AddNotesRequest,
  AddNotesResponse,
  AddUrlRequest,
  AddUrlResponse,
  FileMetadataResponse,
  HydrusApiClient,
  PageInfoResponse,
  PageResponse,
  PopupsResponse,
  SearchFilesResponse,
  Service,
  ServicesResponse,
  SetFileRelationshipsRequest,
  TagUpdates,
  TagsResponse,
} from "./types";

/**
 * Mock implementation of the Hydrus API client for testing
 */
export class MockHydrusClient implements HydrusApiClient {
  private apiKey: string = "";
  private validApiKey: string = "valid-api-key";

  // Sample data for testing
  private pages: PageResponse = {
    version: 1,
    hydrus_version: 1,
    pages: {
      name: "top pages notebook",
      page_key: "top-page-key",
      page_state: 0,
      page_type: 10,
      is_media_page: false,
      selected: true,
      pages: [
        {
          name: "files",
          page_key: "files-page-key",
          page_state: 0,
          page_type: 6,
          is_media_page: true,
          selected: true,
        },
      ],
    },
  };

  private pageInfo: Record<string, PageInfoResponse> = {
    "files-page-key": {
      version: 1,
      hydrus_version: 1,
      page_info: {
        name: "files",
        page_key: "files-page-key",
        page_state: 0,
        page_type: 6,
        is_media_page: true,
        media: {
          num_files: 15,
          hash_ids: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
        },
      },
    },
  };

  private fileMetadata: FileMetadataResponse = {
    version: 1,
    hydrus_version: 1,
    services: {
      c6f63616c2074616773: {
        name: "my tags",
        type: ServiceType.LOCAL_TAG,
        type_pretty: "local tag service",
      },
    },
    metadata: [
      {
        file_id: 1,
        hash: "hash1",
        size: 12345,
        mime: "image/jpeg",
        width: 800,
        height: 600,
        is_inbox: false,
        is_local: true,
        tags: {
          c6f63616c2074616773: {
            storage_tags: { "0": ["tag1", "tag2"] },
            display_tags: { "0": ["tag1", "tag2"] },
          },
        },
      },
      {
        file_id: 2,
        hash: "hash2",
        size: 23456,
        mime: "image/png",
        width: 1024,
        height: 768,
        is_inbox: true,
        is_local: true,
        tags: {
          c6f63616c2074616773: {
            storage_tags: { "0": ["tag2", "tag3"] },
            display_tags: { "0": ["tag2", "tag3"] },
          },
        },
      },
    ],
  };

  private searchResults: SearchFilesResponse = {
    version: 1,
    hydrus_version: 1,
    file_ids: [1, 2],
  };

  private tagSearchResults: TagsResponse = {
    version: 1,
    hydrus_version: 1,
    tags: [
      { value: "tag1", count: 1 },
      { value: "tag2", count: 2 },
      { value: "tag3", count: 1 },
    ],
  };

  private services: Record<string, Service> = {
    c6f63616c2074616773: {
      name: "my tags",
      type: ServiceType.LOCAL_TAG,
      type_pretty: "local tag service",
    },
    "5674450950748cfb28778b511024cfbf0f9f67355cf833de632244078b5a6f8d": {
      name: "example tag repo",
      type: ServiceType.TAG_REPOSITORY,
      type_pretty: "hydrus tag repository",
    },
    "6c6f63616c2066696c6573": {
      name: "my files",
      type: ServiceType.LOCAL_FILE_DOMAIN,
      type_pretty: "local file domain",
    },
    "7265706f7369746f72792075706461746573": {
      name: "repository updates",
      type: ServiceType.LOCAL_FILE_UPDATE_DOMAIN,
      type_pretty: "local update file domain",
    },
    ae7d9a603008919612894fc360130ae3d9925b8577d075cd0473090ac38b12b6: {
      name: "example file repo",
      type: ServiceType.FILE_REPOSITORY,
      type_pretty: "hydrus file repository",
    },
    "616c6c206c6f63616c2066696c6573": {
      name: "all local files",
      type: ServiceType.COMBINED_LOCAL_FILE,
      type_pretty: "virtual combined local file service",
    },
    "616c6c206c6f63616c206d65646961": {
      name: "all my files",
      type: ServiceType.COMBINED_LOCAL_MEDIA,
      type_pretty: "virtual combined local media service",
    },
    "616c6c206b6e6f776e2066696c6573": {
      name: "all known files",
      type: ServiceType.COMBINED_FILE,
      type_pretty: "virtual combined file service",
    },
    "616c6c206b6e6f776e2074616773": {
      name: "all known tags",
      type: ServiceType.COMBINED_TAG,
      type_pretty: "virtual combined tag service",
    },
    "74d52c6238d25f846d579174c11856b1aaccdb04a185cb2c79f0d0e499284f2c": {
      name: "example local rating like service",
      type: ServiceType.LOCAL_RATING_LIKE,
      type_pretty: "local like/dislike rating service",
      star_shape: "circle",
    },
    "90769255dae5c205c975fc4ce2efff796b8be8a421f786c1737f87f98187ffaf": {
      name: "example local rating numerical service",
      type: ServiceType.LOCAL_RATING_NUMERICAL,
      type_pretty: "local numerical rating service",
      star_shape: "fat star",
      min_stars: 1,
      max_stars: 5,
    },
    b474e0cbbab02ca1479c12ad985f1c680ea909a54eb028e3ad06750ea40d4106: {
      name: "example local rating inc/dec service",
      type: ServiceType.LOCAL_RATING_INCDEC,
      type_pretty: "local inc/dec rating service",
    },
    "7472617368": {
      name: "trash",
      type: ServiceType.LOCAL_FILE_TRASH_DOMAIN,
      type_pretty: "local trash file domain",
    },
  };

  /**
   * Set the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Verify the access key
   */
  async verifyAccessKey(apiKey?: string): Promise<boolean> {
    const key = apiKey || this.apiKey;
    return key === this.validApiKey;
  }

  /**
   * Search for files by tags
   */
  async searchFiles(): Promise<SearchFilesResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return { ...this.searchResults };
  }

  /**
   * Get metadata for files
   */
  async getFileMetadata(fileIds: number[]): Promise<FileMetadataResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Filter metadata to only include requested file IDs
    const filteredMetadata = this.fileMetadata.metadata.filter((m) =>
      fileIds.includes(m.file_id),
    );

    return {
      ...this.fileMetadata,
      metadata: filteredMetadata,
    };
  }

  /**
   * Get metadata for files by their hashes
   */
  async getFileMetadataByHashes(
    hashes: string[],
  ): Promise<FileMetadataResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Filter metadata to only include requested hashes
    const filteredMetadata = this.fileMetadata.metadata.filter((m) =>
      hashes.includes(m.hash),
    );

    return {
      ...this.fileMetadata,
      metadata: filteredMetadata,
    };
  }

  /**
   * Get the direct URL for a file
   */
  getFileUrl(fileId: number): string {
    // For testing, return a placeholder URL
    return `/mock-file-${fileId}`;
  }

  /**
   * Get the direct URL for a thumbnail
   */
  getThumbnailUrl(fileId: number): string {
    // For testing, return a placeholder URL
    return `/mock-thumbnail-${fileId}`;
  }

  /**
   * Search for tags
   */
  async searchTags(search: string): Promise<TagsResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Filter tags that match the search term
    const filteredTags = this.tagSearchResults.tags.filter((tag) =>
      tag.value.includes(search),
    );

    return {
      ...this.tagSearchResults,
      tags: filteredTags,
    };
  }

  /**
   * Get pages
   */
  async getPages(): Promise<PageResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return { ...this.pages };
  }

  /**
   * Get information about a specific page
   */
  async getPageInfo(pageKey: string): Promise<PageInfoResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Return the page info if it exists, otherwise return a default
    if (this.pageInfo[pageKey]) {
      return { ...this.pageInfo[pageKey] };
    }

    // Default page info for unknown pages
    return {
      version: 1,
      hydrus_version: 1,
      page_info: {
        name: "Unknown Page",
        page_key: pageKey,
        page_state: 0,
        page_type: 6,
        is_media_page: true,
        media: {
          num_files: 0,
          hash_ids: [],
        },
      },
    };
  }

  /**
   * Add files to a page
   */
  async addFiles(request: AddFilesRequest): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    if (request.file_ids) {
      const pageInfo = this.pageInfo[request.page_key].page_info;
      if (pageInfo.media) {
        pageInfo.media.hash_ids.push(...request.file_ids);
        pageInfo.media.num_files = pageInfo.media.hash_ids.length;
      } else {
        throw new Error("Page not found");
      }
    }

    if (request.hashes) {
      const pageInfo = this.pageInfo[request.page_key].page_info;
      if (pageInfo.media) {
        pageInfo.media.hash_ids.push(
          ...request.hashes.map(
            (hash) =>
              this.fileMetadata.metadata.find((m) => m.hash === hash)
                ?.file_id || 0,
          ),
        );
        pageInfo.media.num_files = pageInfo.media.hash_ids.length;
      } else {
        throw new Error("Page not found");
      }
    }
  }

  /**
   * Refresh a page
   */
  async refreshPage(): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return;
  }

  /**
   * Get current popups and jobs
   */
  async getPopups(): Promise<PopupsResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Return mock job statuses
    return {
      version: 1,
      hydrus_version: 1,
      job_statuses: [
        {
          key: "mock-job-1",
          creation_time: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
          had_error: false,
          is_cancellable: false,
          is_cancelled: false,
          is_done: false,
          is_pausable: true,
          is_paused: false,
          nice_string: "Processing files...",
          files: {
            hashes: ["hash1", "hash2", "hash3"],
            label: "Import",
          },
        },
        {
          key: "mock-job-2",
          creation_time: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
          had_error: true,
          is_cancellable: false,
          is_cancelled: false,
          is_done: true,
          is_pausable: false,
          is_paused: false,
          nice_string: "Failed to process files",
          files: {
            hashes: ["hash4", "hash5"],
            label: "Tag Search",
          },
        },
      ],
    };
  }

  /**
   * Dismiss a popup
   */
  async dismissPopup(): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }
    // In the mock, we don't need to do anything
  }

  /**
   * Get all services
   */
  async getServices(): Promise<ServicesResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return {
      version: 1,
      hydrus_version: 1,
      services: { ...this.services },
    };
  }

  /**
   * Get a specific service by key
   */
  async getService(serviceKey: string): Promise<Service> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    const service = this.services[serviceKey];
    if (!service) {
      throw new Error(`Service ${serviceKey} not found`);
    }

    return { ...service };
  }

  /**
   * Set a rating for a file
   */
  async setRating(
    fileId: number,
    serviceKey: string,
    rating: boolean | number | null,
  ): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Find the file in our mock data
    const fileIndex = this.fileMetadata.metadata.findIndex(
      (f) => f.file_id === fileId,
    );
    if (fileIndex === -1) {
      throw new Error("File not found");
    }

    // Update the rating
    const file = this.fileMetadata.metadata[fileIndex];
    if (!file.ratings) {
      file.ratings = {};
    }
    file.ratings[serviceKey] = rating;
  }

  /**
   * Add or remove tags from a file
   */
  async editTags(fileIds: number[], updates: TagUpdates): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Find the file in our mock data
    for (const fileId of fileIds) {
      const fileIndex = this.fileMetadata.metadata.findIndex(
        (f) => f.file_id === fileId,
      );
      if (fileIndex === -1) {
        throw new Error("File not found");
      }

      // Update the tags
      const file = this.fileMetadata.metadata[fileIndex];
      if (!file.tags) {
        file.tags = {};
      }

      // Process each service's updates
      for (const [serviceKey, actions] of Object.entries(updates)) {
        if (!file.tags![serviceKey]) {
          file.tags![serviceKey] = {
            storage_tags: { "0": [] },
            display_tags: { "0": [] },
          };
        }

        // Process each action's tags
        for (const [actionStr, tags] of Object.entries(actions)) {
          const action = parseInt(actionStr);
          const currentTags = new Set(file.tags![serviceKey].storage_tags["0"]);

          if (action === ContentUpdateAction.ADD) {
            for (const tag of tags) {
              currentTags.add(tag);
            }
          } else if (action === ContentUpdateAction.DELETE) {
            for (const tag of tags) {
              currentTags.delete(tag);
            }
          }

          file.tags![serviceKey].storage_tags["0"] = Array.from(currentTags);
          file.tags![serviceKey].display_tags["0"] = Array.from(currentTags);
        }
      }
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(): Promise<AddFileResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return {
      version: 1,
      hydrus_version: 1,
      hash: "hash1",
      status: 1,
      note: "File uploaded successfully",
    };
  }

  /**
   * Import a URL into Hydrus (mock implementation)
   */
  async addUrl(request: AddUrlRequest): Promise<AddUrlResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    return {
      version: 1,
      hydrus_version: 1,
      human_result_text: `"${request.url}" URL added successfully.`,
      normalised_url: request.url,
    };
  }

  /**
   * Associate a URL with a file
   */
  async associateUrl(): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }
  }

  /**
   * Set relationships between pairs of files (mock implementation)
   */
  async setFileRelationships(
    request: SetFileRelationshipsRequest,
  ): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    if (!request.relationships || !Array.isArray(request.relationships)) {
      throw new Error("Invalid request");
    }

    // Not implemented
    return;
  }

  /**
   * Set files as kings of their duplicate groups (mock implementation)
   */
  async setKings(): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Not implemented
    return;
  }

  async addNotes(request: AddNotesRequest): Promise<AddNotesResponse> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Not implemented
    return { notes: { ...request.notes } };
  }

  async deleteNotes(): Promise<void> {
    if (this.apiKey !== this.validApiKey) {
      throw new Error("Invalid API key");
    }

    // Not implemented
    return;
  }
}
