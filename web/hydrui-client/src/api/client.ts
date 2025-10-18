import * as z from "zod/mini";

import { isDemoMode, isServerMode } from "@/utils/modes";

import { DemoServer } from "./demoServer";
import { FetchHttpClient } from "./fetchHttpClient";
import { MemoryHttpClient } from "./memoryHttpClient";
import {
  AddFileResponse,
  AddFilesRequest,
  AddNotesRequest,
  AddNotesResponse,
  AddNotesResponseSchema,
  AddTagsRequest,
  AddUrlRequest,
  AddUrlResponse,
  AddUrlResponseSchema,
  AssociateUrlRequest,
  DeleteNotesRequest,
  DismissPopupRequest,
  FileIdentifiersResponse,
  FileIdentifiersResponseSchema,
  FileMetadataParams,
  FileMetadataResponse,
  FileMetadataResponseSchema,
  GetFileRelationshipsParams,
  GetFileRelationshipsResponse,
  GetFileRelationshipsResponseSchema,
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  HydrusApiClient,
  PageInfoParams,
  PageInfoResponse,
  PageInfoResponseSchema,
  PageResponse,
  PageResponseSchema,
  PopupsResponse,
  PopupsResponseSchema,
  RefreshPageRequest,
  SearchFilesParams,
  SearchFilesResponse,
  SearchFilesResponseSchema,
  Service,
  ServicesResponse,
  ServicesResponseSchema,
  SetFileRelationshipsRequest,
  SetKingsRequest,
  SetRatingRequest,
  TagUpdates,
  TagsResponse,
  TagsResponseSchema,
  TagsSearchParams,
} from "./types";

type NoParams = Record<string, never>;

interface RequestOptions<Params, Request> {
  body?: Request | undefined;
  params?: Params | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Hydrus network client API
 */
export class HydrusClient implements HydrusApiClient {
  private baseUrl: string;
  private apiKey: string;
  private httpClient: HttpClient;
  private demoServer?: DemoServer;

  constructor(
    baseUrl: string = "http://localhost:45869",
    apiKey: string = "",
    httpClient: HttpClient = new FetchHttpClient(),
  ) {
    this.baseUrl = isServerMode ? "/hydrus" : baseUrl;
    this.apiKey = isServerMode ? "" : apiKey;
    if (isDemoMode) {
      this.demoServer = new DemoServer();
      this.httpClient = new MemoryHttpClient(this.demoServer);
    } else {
      this.httpClient = httpClient;
    }
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

  private async get<
    Params = NoParams,
    ResponseSchema extends z.ZodMiniType = z.ZodMiniVoid,
  >(
    endpoint: string,
    responseSchema: ResponseSchema,
    options: {
      params?: Params | undefined;
      signal?: AbortSignal | undefined;
    } = {},
  ): Promise<z.infer<ResponseSchema>> {
    return this.requestWithResponseBody(
      "GET",
      endpoint,
      responseSchema,
      options,
    );
  }

  private async post<
    Params = NoParams,
    Request = null,
    ResponseSchema extends z.ZodMiniType = z.ZodMiniVoid,
  >(
    endpoint: string,
    responseSchema: ResponseSchema,
    options: RequestOptions<Params, Request> = {},
  ): Promise<z.infer<ResponseSchema>> {
    return this.requestWithResponseBody(
      "POST",
      endpoint,
      responseSchema,
      options,
    );
  }

  private async postEmpty<Params = NoParams, Request = null>(
    endpoint: string,
    options: RequestOptions<Params, Request> = {},
  ): Promise<void> {
    return this.requestEmpty("POST", endpoint, options);
  }

  private async requestWithResponseBody<
    Params = NoParams,
    Request = null,
    ResponseSchema extends z.ZodMiniType = z.ZodMiniVoid,
  >(
    method: "GET" | "POST" = "GET",
    endpoint: string,
    responseSchema: ResponseSchema,
    options: RequestOptions<Params, Request> = {},
  ): Promise<z.infer<ResponseSchema>> {
    const response = await this.requestRaw(method, endpoint, options);

    // Check if response is empty
    const contentLength = response.headers.get("Content-Length");
    const contentType = response.headers.get("Content-Type");

    if (contentLength === "0" || !contentType?.includes("application/json")) {
      return responseSchema.parse(undefined);
    }

    // Return the response data
    return responseSchema.parse(await response.json());
  }

  private async requestEmpty<Params = NoParams, Request = null>(
    method: "GET" | "POST" = "GET",
    endpoint: string,
    options: RequestOptions<Params, Request> = {},
  ): Promise<void> {
    await this.requestRaw(method, endpoint, options);
    return;
  }

  private async requestRaw<Params = NoParams, Request = null>(
    method: "GET" | "POST" = "GET",
    endpoint: string,
    { body, params, signal }: RequestOptions<Params, Request> = {},
  ): Promise<HttpResponse> {
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
    const options: HttpRequestOptions = {
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
    const response = await this.httpClient.fetch(url, options);

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

    return response;
  }

  /**
   * Verify the access key is valid
   */
  async verifyAccessKey(apiKey?: string): Promise<boolean> {
    const key = apiKey || this.apiKey;
    if (!key && !isServerMode) return false;

    try {
      const response = await this.httpClient.fetch(
        `${this.baseUrl}/verify_access_key`,
        {
          method: "GET",
          headers: {
            "Hydrus-Client-API-Access-Key": key,
          },
        },
      );
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
    return this.get("/get_files/search_files", SearchFilesResponseSchema, {
      params,
      signal,
    });
  }

  /**
   * Get metadata for files
   */
  async getFileMetadata(
    fileIds: number[],
    signal?: AbortSignal,
  ): Promise<FileMetadataResponse> {
    const params: FileMetadataParams = {
      file_ids: fileIds,
      include_notes: true,
    };
    return this.get("/get_files/file_metadata", FileMetadataResponseSchema, {
      params,
      signal,
    });
  }

  /**
   * Get file IDs for hashes
   */
  async getFileIdsByHashes(
    hashes: string[],
    signal?: AbortSignal,
  ): Promise<FileIdentifiersResponse> {
    const params: FileMetadataParams = {
      hashes,
      only_return_identifiers: true,
    };
    return this.get("/get_files/file_metadata", FileIdentifiersResponseSchema, {
      params,
      signal,
    });
  }

  /**
   * Get metadata for files by their hashes
   */
  async getFileMetadataByHashes(
    hashes: string[],
    signal?: AbortSignal,
  ): Promise<FileMetadataResponse> {
    const params: FileMetadataParams = { hashes, include_notes: true };
    return this.get("/get_files/file_metadata", FileMetadataResponseSchema, {
      params,
      signal,
    });
  }

  /**
   * Get the direct URL for a file
   */
  getFileUrl(fileId: number): string {
    if (isDemoMode) {
      return String(this.demoServer!.getDemoFile(fileId, "file"));
    }
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
      await this.httpClient.fetch(bridgePath, {
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
    if (isDemoMode) {
      return String(this.demoServer!.getDemoFile(fileId, "thumbnail"));
    }
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
    const params: TagsSearchParams = {
      search,
      tag_display_type: "display",
      ...(serviceKey ? { tag_service_key: serviceKey } : {}),
    };
    return this.get("/add_tags/search_tags", TagsResponseSchema, {
      params,
      signal,
    });
  }

  /**
   * Get pages
   */
  async getPages(): Promise<PageResponse> {
    return this.get("/manage_pages/get_pages", PageResponseSchema);
  }

  /**
   * Get information about a specific page
   */
  async getPageInfo(pageKey: string): Promise<PageInfoResponse> {
    const params: PageInfoParams = { page_key: pageKey };
    return this.get("/manage_pages/get_page_info", PageInfoResponseSchema, {
      params,
    });
  }

  /**
   * Add files to a page
   */
  async addFiles(body: AddFilesRequest): Promise<void> {
    return this.postEmpty("/manage_pages/add_files", { body });
  }

  /**
   * Refresh a page
   */
  async refreshPage(pageKey: string): Promise<void> {
    const body: RefreshPageRequest = { page_key: pageKey };
    return this.postEmpty("/manage_pages/refresh_page", {
      body,
    });
  }

  /**
   * Get current popups and jobs
   */
  async getPopups(): Promise<PopupsResponse> {
    return this.get("/manage_popups/get_popups", PopupsResponseSchema);
  }

  /**
   * Dismiss a popup
   */
  async dismissPopup(jobKey: string): Promise<void> {
    const body: DismissPopupRequest = { job_status_key: jobKey };
    await this.postEmpty("/manage_popups/dismiss_popup", { body });
  }

  async getServices(): Promise<ServicesResponse> {
    return this.get("/get_services", ServicesResponseSchema);
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
    const body: SetRatingRequest = {
      file_id: fileId,
      rating_service_key: serviceKey,
      rating,
    };
    await this.postEmpty("/edit_ratings/set_rating", { body });
  }

  /**
   * Add or remove tags from a file
   */
  async editTags(fileIds: number[], updates: TagUpdates): Promise<void> {
    const body: AddTagsRequest = {
      file_ids: fileIds,
      service_keys_to_actions_to_tags: updates,
    };
    await this.postEmpty("/add_tags/add_tags", { body });
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: File,
    progressCallback?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<AddFileResponse> {
    if (isDemoMode) {
      // For the demo, use fetch.
      const response = await this.httpClient.fetch(
        `${this.baseUrl}/add_files/add_file`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type,
            "Hydrus-Client-API-Access-Key": this.apiKey,
          },
          body: file,
        },
      );
      return (await response.json()) as AddFileResponse;
    }
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
  async addUrl(body: AddUrlRequest): Promise<AddUrlResponse> {
    return this.post("/add_urls/add_url", AddUrlResponseSchema, { body });
  }

  /**
   * Associate a URL with a file
   */
  async associateUrl(body: AssociateUrlRequest): Promise<void> {
    return this.postEmpty("/add_urls/associate_url", { body });
  }

  /**
   * Get relationships of files
   */
  async getFileRelationships(
    params: GetFileRelationshipsParams,
  ): Promise<GetFileRelationshipsResponse> {
    return this.get(
      "/manage_file_relationships/get_file_relationships",
      GetFileRelationshipsResponseSchema,
      { params },
    );
  }

  /**
   * Set relationships between pairs of files
   *
   * This endpoint allows setting duplicate status and other relationships between file pairs
   */
  async setFileRelationships(body: SetFileRelationshipsRequest): Promise<void> {
    return this.postEmpty("/manage_file_relationships/set_file_relationships", {
      body,
    });
  }

  /**
   * Set the specified files to be the kings (best quality) of their duplicate groups
   *
   * If multiple files from the same group are specified, the last one in the array becomes the king
   */
  async setKings(fileIds: number[]): Promise<void> {
    const body: SetKingsRequest = { file_ids: fileIds };
    return this.postEmpty("/manage_file_relationships/set_kings", { body });
  }

  async addNotes(body: AddNotesRequest): Promise<AddNotesResponse> {
    return this.post("/add_notes/set_notes", AddNotesResponseSchema, { body });
  }

  async deleteNotes(body: DeleteNotesRequest): Promise<void> {
    return this.postEmpty("/add_notes/delete_notes", { body });
  }
}
