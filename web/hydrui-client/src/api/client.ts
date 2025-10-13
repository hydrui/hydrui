import { isServerMode } from "@/utils/serverMode";

import {
  AddFileResponse,
  AddFilesRequest,
  AddNotesRequest,
  AddNotesResponse,
  AddUrlRequest,
  AddUrlResponse,
  AssociateUrlRequest,
  DeleteNotesRequest,
  FileIdentifiersResponse,
  FileMetadataParams,
  FileMetadataResponse,
  HydrusApiClient,
  PageInfoParams,
  PageInfoResponse,
  PageResponse,
  PopupsResponse,
  RefreshPageRequest,
  SearchFilesParams,
  SearchFilesResponse,
  Service,
  ServicesResponse,
  SetFileRelationshipsRequest,
  SetKingsRequest,
  TagUpdates,
  TagsResponse,
  TagsSearchParams,
} from "./types";

type NoParams = Record<string, never>;

/**
 * Hydrus network client API
 */
export class HydrusClient implements HydrusApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = "http://localhost:45869", apiKey: string = "") {
    this.baseUrl = isServerMode ? "/hydrus" : baseUrl;
    this.apiKey = isServerMode ? "" : apiKey;
  }

  /**
   * Set the API key for authentication
   */
  setApiKey(apiKey: string): void {
    if (!isServerMode) {
      this.apiKey = apiKey;
    }
  }

  /**
   * Set the base URL for the API
   */
  setBaseUrl(baseUrl: string): void {
    if (!isServerMode) {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * Make a request to the Hydrus API
   */
  private async request<Response, Request = null, Params = NoParams>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    params?: Params,
    body?: Request,
    signal?: AbortSignal,
  ): Promise<Response> {
    // Prepare URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;

    // Add query params for GET requests
    if (method === "GET" && params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value) || typeof value === "object") {
          queryParams.append(key, JSON.stringify(value));
        } else if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      }
      url += `?${queryParams.toString()}`;
    }

    // Prepare fetch options
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Hydrus-Client-API-Access-Key": this.apiKey,
      },
    };
    if (signal) {
      options.signal = signal;
    }

    // Add body for POST requests
    if (method === "POST" && body) {
      options.body = JSON.stringify(body);
    }

    // Make the request
    const response = await fetch(url, options);

    // Handle errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: { error?: string };
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        console.error(`error during parsing of error: ${e}`);
        // If JSON parsing fails, use the raw error text
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      if (errorJson?.error) {
        throw new Error(`API error: ${response.status} - ${errorJson.error}`);
      }
    }

    // Check if response is empty
    const contentLength = response.headers.get("Content-Length");
    const contentType = response.headers.get("Content-Type");

    if (contentLength === "0" || !contentType?.includes("application/json")) {
      return {} as Response;
    }

    // Return the response data
    return (await response.json()) as Response;
  }

  /**
   * Verify the access key is valid
   */
  async verifyAccessKey(apiKey?: string): Promise<boolean> {
    const key = apiKey || this.apiKey;
    if (!key && !isServerMode) return false;

    try {
      const response = await fetch(`${this.baseUrl}/verify_access_key`, {
        method: "GET",
        headers: {
          "Hydrus-Client-API-Access-Key": key,
        },
      });
      return response.ok && response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Search for files by tags
   */
  async searchFiles(
    params: SearchFilesParams,
    signal?: AbortSignal,
  ): Promise<SearchFilesResponse> {
    return this.request<SearchFilesResponse, null, SearchFilesParams>(
      "/get_files/search_files",
      "GET",
      params,
      null,
      signal,
    );
  }

  /**
   * Get metadata for files
   */
  async getFileMetadata(
    fileIds: number[],
    signal?: AbortSignal,
  ): Promise<FileMetadataResponse> {
    return this.request<FileMetadataResponse, null, FileMetadataParams>(
      "/get_files/file_metadata",
      "GET",
      { file_ids: fileIds, include_notes: true },
      null,
      signal,
    );
  }

  /**
   * Get file IDs for hashes
   */
  async getFileIdsByHashes(
    hashes: string[],
    signal?: AbortSignal,
  ): Promise<FileIdentifiersResponse> {
    return this.request<FileIdentifiersResponse, null, FileMetadataParams>(
      "/get_files/file_metadata",
      "GET",
      { hashes, only_return_identifiers: true },
      null,
      signal,
    );
  }

  /**
   * Get metadata for files by their hashes
   */
  async getFileMetadataByHashes(
    hashes: string[],
    signal?: AbortSignal,
  ): Promise<FileMetadataResponse> {
    return this.request<FileMetadataResponse, null, FileMetadataParams>(
      "/get_files/file_metadata",
      "GET",
      { hashes, include_notes: true },
      null,
      signal,
    );
  }

  /**
   * Get the direct URL for a file
   */
  getFileUrl(fileId: number): string {
    return `${this.baseUrl}/get_files/file?file_id=${fileId}${this.apiKey ? `&Hydrus-Client-API-Access-Key=${this.apiKey}` : ""}`;
  }

  /**
   * Get a direct URL that can be used by other webapps. In Server Mode, this
   * is a one-time URL with no API key or other information in it. Otherwise,
   * it's just a normal file URL, with API key and all.
   */
  async getBridgeUrl(fileId: number): Promise<string> {
    const target = `/get_files/file?file_id=${fileId}${this.apiKey ? `&Hydrus-Client-API-Access-Key=${this.apiKey}` : ""}`;
    if (isServerMode) {
      const bridgePath = `/bridge/${Math.random().toString(36).substring(2)}`;
      await fetch(bridgePath, {
        method: "POST",
        body: JSON.stringify({ target }),
        credentials: "include",
      });
      return new URL(bridgePath, document.URL).toString();
    } else {
      return `${this.baseUrl}${target}`;
    }
  }

  /**
   * Get the direct URL for a thumbnail
   */
  getThumbnailUrl(fileId: number): string {
    return `${this.baseUrl}/get_files/thumbnail?file_id=${fileId}${this.apiKey ? `&Hydrus-Client-API-Access-Key=${this.apiKey}` : ""}`;
  }

  /**
   * Search for tags
   */
  async searchTags(
    search: string,
    serviceKey?: string,
    signal?: AbortSignal,
  ): Promise<TagsResponse> {
    return this.request<TagsResponse, null, TagsSearchParams>(
      "/add_tags/search_tags",
      "GET",
      {
        search,
        tag_display_type: "display",
        ...(serviceKey ? { tag_service_key: serviceKey } : {}),
      },
      null,
      signal,
    );
  }

  /**
   * Get pages
   */
  async getPages(): Promise<PageResponse> {
    return this.request<PageResponse>("/manage_pages/get_pages", "GET");
  }

  /**
   * Get information about a specific page
   */
  async getPageInfo(pageKey: string): Promise<PageInfoResponse> {
    return this.request<PageInfoResponse, null, PageInfoParams>(
      "/manage_pages/get_page_info",
      "GET",
      { page_key: pageKey },
    );
  }

  /**
   * Add files to a page
   */
  async addFiles(request: AddFilesRequest): Promise<void> {
    return this.request<void, AddFilesRequest>(
      "/manage_pages/add_files",
      "POST",
      {},
      request,
    );
  }

  /**
   * Refresh a page
   */
  async refreshPage(pageKey: string): Promise<void> {
    return this.request<void, RefreshPageRequest>(
      "/manage_pages/refresh_page",
      "POST",
      {},
      { page_key: pageKey },
    );
  }

  /**
   * Get current popups and jobs
   */
  async getPopups(): Promise<PopupsResponse> {
    return this.request<PopupsResponse>("/manage_popups/get_popups", "GET");
  }

  /**
   * Dismiss a popup
   */
  async dismissPopup(jobKey: string): Promise<void> {
    await this.request(
      "/manage_popups/dismiss_popup",
      "POST",
      {},
      { job_status_key: jobKey },
    );
  }

  async getServices(): Promise<ServicesResponse> {
    return this.request<ServicesResponse>("/get_services");
  }

  async getService(serviceKey: string): Promise<Service> {
    const response = await this.getServices();
    const service = response.services[serviceKey];
    if (!service) {
      throw new Error(`Service ${serviceKey} not found`);
    }
    return service;
  }

  /**
   * Set a rating for a file
   */
  async setRating(
    fileId: number,
    serviceKey: string,
    rating: boolean | number | null,
  ): Promise<void> {
    // First get the file hash
    const response = await this.getFileMetadata([fileId]);
    if (!response.metadata[0]) {
      throw new Error("File not found");
    }
    const hash = response.metadata[0].hash;

    // Then set the rating
    await this.request(
      "/edit_ratings/set_rating",
      "POST",
      {},
      {
        hash,
        rating_service_key: serviceKey,
        rating,
      },
    );
  }

  /**
   * Add or remove tags from a file
   */
  async editTags(fileIds: number[], updates: TagUpdates): Promise<void> {
    await this.request(
      "/add_tags/add_tags",
      "POST",
      {},
      {
        file_ids: fileIds,
        service_keys_to_actions_to_tags: updates,
      },
    );
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: File,
    progressCallback?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<AddFileResponse> {
    // For portability, we need to use an XHR for this to get progress.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/add_files/add_file`, true);
      xhr.setRequestHeader("Hydrus-Client-API-Access-Key", this.apiKey);
      xhr.onload = () => resolve(JSON.parse(xhr.responseText));
      xhr.onerror = () => reject(new Error("Failed to upload file"));
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          progressCallback?.((event.loaded / event.total) * 100);
        }
      };
      xhr.send(file);
      signal?.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload aborted"));
      });
    });
  }

  /**
   * Import a URL into Hydrus
   */
  async addUrl(request: AddUrlRequest): Promise<AddUrlResponse> {
    return this.request<AddUrlResponse, AddUrlRequest>(
      "/add_urls/add_url",
      "POST",
      {},
      request,
    );
  }

  /**
   * Associate a URL with a file
   */
  async associateUrl(request: AssociateUrlRequest): Promise<void> {
    return this.request<void, AssociateUrlRequest>(
      "/add_urls/associate_url",
      "POST",
      {},
      request,
    );
  }

  /**
   * Set relationships between pairs of files
   *
   * This endpoint allows setting duplicate status and other relationships between file pairs
   */
  async setFileRelationships(
    request: SetFileRelationshipsRequest,
  ): Promise<void> {
    return this.request<void, SetFileRelationshipsRequest>(
      "/manage_file_relationships/set_file_relationships",
      "POST",
      {},
      request,
    );
  }

  /**
   * Set the specified files to be the kings (best quality) of their duplicate groups
   *
   * If multiple files from the same group are specified, the last one in the array becomes the king
   */
  async setKings(fileIds: number[]): Promise<void> {
    return this.request<void, SetKingsRequest>(
      "/manage_file_relationships/set_kings",
      "POST",
      {},
      { file_ids: fileIds },
    );
  }

  async addNotes(request: AddNotesRequest): Promise<AddNotesResponse> {
    return this.request<AddNotesResponse, AddNotesRequest>(
      "/add_notes/set_notes",
      "POST",
      {},
      request,
    );
  }

  async deleteNotes(request: DeleteNotesRequest): Promise<void> {
    return this.request<void, DeleteNotesRequest>(
      "/add_notes/delete_notes",
      "POST",
      {},
      request,
    );
  }
}
