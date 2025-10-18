import { HttpClient, HttpRequestOptions, HttpResponse } from "./types";

export interface HttpHandler {
  handle(request: Request, body: Blob): Promise<Response>;
}

export class MemoryHttpClient implements HttpClient {
  constructor(private handler: HttpHandler) {}

  async fetch(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    let body: Blob;
    if (options.body === undefined || options.body === null) {
      body = new Blob();
    } else if (options.body instanceof Blob) {
      body = options.body;
    } else {
      body = new Blob([options.body]);
    }
    try {
      return await this.handler.handle(new Request(url, options), body);
    } catch (e) {
      if (e instanceof Response) {
        return e;
      }
      throw e;
    }
  }
}
