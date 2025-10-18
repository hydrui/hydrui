import { HttpClient, HttpRequestOptions, HttpResponse } from "./types";

export class FetchHttpClient implements HttpClient {
  fetch(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    return globalThis.fetch(url, options);
  }
}
