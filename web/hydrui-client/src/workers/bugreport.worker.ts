// This worker is used to handle sending data back to the Hydrui developers
// Right now, it's only used to handle encrypting and sending broken PSDs.
// Hydrui only sends data this way when the user explicitly requests it.
import { sealedbox } from "@/utils/nacl";

// This is the public key of the Hydrui developers.
// Once the request is encrypted using this key, it can only be decrypted by
// the developers.
// While this ensures confidentiality, it does not provide anonymity.
// For maximum privacy, connect to Tor or a VPN before sending a report.
const recipientPk = new Uint8Array([
  0x68, 0xa4, 0x03, 0x85, 0x5a, 0xfa, 0xd0, 0x98, 0x15, 0x20, 0x99, 0x4b, 0xb5,
  0xbf, 0xf5, 0xdb, 0x71, 0x14, 0x02, 0xdc, 0x77, 0xdf, 0x6e, 0xe9, 0x4b, 0x48,
  0x45, 0xb5, 0x4b, 0x99, 0x84, 0x46,
]);

// This is the URL of the Hydrui report endpoint.
// The source code for the Hydrui server is in cmd/hydrui-dev.
const BUG_REPORT_URL = "https://api.hydrui.dev/bug-report";

// Chunk size to use for encrypted chunks. 8 KiB should be good enough to
// reasonably ammortize the 48 byte overhead of a sealedbox.
const CHUNK_SIZE = 8192;

// Overhead per chunk. Used to calculate the total size of the encrypted
// blob that is sent to the server. This is the 48 bytes of sealedbox
// overhead, plus the 4 bytes for the length prefix on each chunk.
// Sealed box overhead is 32-byte key + 24-byte nonce.
const CHUNK_OVERHEAD = 48 + 4;

type ReportBrokenImageRequest = {
  type: "reportBrokenImage";
  url: string;
  serverMode: boolean;
};

export type WorkerRequest = ReportBrokenImageRequest;

type ReportBrokenImageProgressResponse = {
  type: "reportBrokenImageProgress";
  url: string;
  progress: number;
};

type ReportBrokenImageResponse = {
  type: "reportBrokenImage";
  url: string;
  success: boolean;
  error?: string;
};

export type WorkerResponse =
  | ReportBrokenImageProgressResponse
  | ReportBrokenImageResponse;

function postMessage(response: WorkerResponse) {
  self.postMessage(response);
}

self.onmessage = (event) => {
  const request = event.data as WorkerRequest;
  switch (request.type) {
    case "reportBrokenImage":
      reportBrokenImage(request.url, request.serverMode);
      break;
    default:
      throw new Error(`Unknown request type: ${request.type}`);
  }
};

class CryptTransformer extends TransformStream {
  constructor(callback: (bytesWritten: number) => void) {
    let bytesWritten = 0;
    const chunkQueue: Uint8Array[] = [];
    let controller!: TransformStreamDefaultController;
    const writeChunks = (endOfStream: boolean) => {
      while (
        endOfStream
          ? chunkQueue.length > 0
          : chunkQueue.reduce((n, c) => n + c.length, 0) >= CHUNK_SIZE
      ) {
        let msgBuffer = new Uint8Array(CHUNK_SIZE);
        for (let i = 0; i < CHUNK_SIZE; ) {
          const chunk = chunkQueue.shift();
          if (!chunk) {
            if (endOfStream) {
              msgBuffer = msgBuffer.subarray(0, i);
              break;
            }
            throw new Error("BUG: chunks depleted unexpectedly");
          }
          const amountToConsume = Math.min(chunk.length, CHUNK_SIZE - i);
          msgBuffer.set(chunk.subarray(0, amountToConsume), i);
          i += amountToConsume;
          if (amountToConsume < chunk.length) {
            chunkQueue.unshift(chunk.subarray(amountToConsume, chunk.length));
            if (i != CHUNK_SIZE) throw new Error("BUG: bad chunk read");
          }
        }
        const chunkLength = new Uint8Array(4);
        const cryptedChunk = sealedbox(msgBuffer, recipientPk);
        new DataView(chunkLength.buffer).setUint32(
          0,
          cryptedChunk.length,
          false,
        );
        const fullChunk = new Uint8Array(
          chunkLength.length + cryptedChunk.length,
        );
        fullChunk.set(chunkLength, 0);
        fullChunk.set(cryptedChunk, chunkLength.length);
        controller.enqueue(fullChunk);
        callback((bytesWritten += fullChunk.length));
      }
    };
    super({
      start(ctrl) {
        controller = ctrl;
      },
      async transform(chunk) {
        const data = await chunk;
        if (typeof data != "object" || !ArrayBuffer.isView(data)) {
          throw new Error(`Unhandled stream object: ${data}`);
        }
        chunkQueue.push(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
        writeChunks(false);
      },
      flush() {
        writeChunks(true);
      },
    });
  }
}

function calculateCryptOverhead(plaintextSize: number): number {
  const boxes = ((plaintextSize + CHUNK_SIZE - 1) / CHUNK_SIZE) | 0;
  return boxes * CHUNK_OVERHEAD;
}

function calculateCryptSize(plaintextSize: number): number {
  return plaintextSize + calculateCryptOverhead(plaintextSize);
}

async function reportBrokenImage(url: string, serverMode: boolean) {
  try {
    postMessage({
      type: "reportBrokenImageProgress",
      url,
      progress: NaN,
    });
    const abortController = new AbortController();
    let gotStatus = false;
    let finishedSending = false;
    let totalLength = NaN;
    let totalLengthEncrypted = NaN;
    const stream = await fetch(url)
      .then((response) => {
        if (response.headers.has("Content-Length")) {
          totalLength = Number(response.headers.get("Content-Length"));
          totalLengthEncrypted = calculateCryptSize(totalLength);
        }
        return response.body;
      })
      .then((body) =>
        body?.pipeThrough(
          new CryptTransformer((bytesWritten) => {
            postMessage({
              type: "reportBrokenImageProgress",
              url,
              progress: bytesWritten / totalLengthEncrypted,
            });
          }),
        ),
      );
    if (!stream) {
      postMessage({
        type: "reportBrokenImage",
        url,
        success: false,
        error: "Origin request did not return a response body.",
      });
      return;
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(serverMode ? "/bug-report" : BUG_REPORT_URL);
    } catch (e) {
      postMessage({
        type: "reportBrokenImage",
        url,
        success: false,
        error: `Could not connect to origin: ${e}.`,
      });
      return;
    }
    socket.addEventListener("open", async () => {
      try {
        socket.send(
          JSON.stringify({
            contentLength: totalLengthEncrypted,
          }),
        );
        await stream.pipeTo(
          new WritableStream({
            write(data) {
              socket.send(data);
            },
            close() {},
          }),
          {
            signal: abortController.signal,
          },
        );
      } catch (e) {
        if (!(e instanceof Error) || e.name !== "AbortError") {
          postMessage({
            type: "reportBrokenImage",
            url,
            success: false,
            error: `Error while uploading to origin: ${e}.`,
          });
        }
      } finally {
        finishedSending = true;
      }
    });
    socket.addEventListener("error", function (e) {
      postMessage({
        type: "reportBrokenImage",
        url,
        success: false,
        error: `Websocket error: ${e}.`,
      });
    });
    socket.addEventListener("close", function () {
      if (!gotStatus) {
        postMessage({
          type: "reportBrokenImage",
          url,
          success: false,
          error: "Websocket closed without a status",
        });
      }
    });
    socket.addEventListener("message", function (e) {
      try {
        const message: { success: true } & { error: string } = JSON.parse(
          e.data,
        );
        if (message.success) {
          gotStatus = true;
          if (finishedSending) {
            postMessage({
              type: "reportBrokenImage",
              url,
              success: true,
            });
          } else {
            postMessage({
              type: "reportBrokenImage",
              url,
              success: false,
              error:
                "Server reported success before we finished sending payload (bug?)",
            });
          }
        } else if (message.error) {
          gotStatus = true;
          postMessage({
            type: "reportBrokenImage",
            url,
            success: false,
            error: `Server returned an error: ${message.error}`,
          });
          abortController.abort();
        }
      } catch (e) {
        postMessage({
          type: "reportBrokenImage",
          url,
          success: false,
          error: `Server sent a status message, but it could not be parsed: ${e}`,
        });
      }
    });
  } catch (error) {
    postMessage({
      type: "reportBrokenImage",
      url,
      success: false,
      error: `${error}`,
    });
  }
}
