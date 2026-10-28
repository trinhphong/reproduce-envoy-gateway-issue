const path = require("node:path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync(path.join(__dirname, "ext_proc.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition).envoy.service.ext_proc.v3;

function continueResponse(kind) {
  return { [kind]: { response: { status: "CONTINUE" } } };
}

function processCall(call) {
  call.on("data", (request) => {
    const kind = request.request;
    if (kind === "response_body") {
      const body = request.response_body?.body;
      const size = body == null ? 0 : Buffer.byteLength(body);
      const end = request.response_body?.end_of_stream;
      if (size >= 16 * 1024) {
        console.log(
          `[ext-proc] ======== 16KB REACHED response body ${size} bytes — streaming continues ========`,
        );
      } else {
        console.log(`response body ${size} bytes end=${end}`);
      }
    } else {
      console.log(kind || "empty");
    }
    if (
      kind === "request_headers" ||
      kind === "response_headers" ||
      kind === "request_body" ||
      kind === "response_body"
    ) {
      call.write(continueResponse(kind));
      return;
    }
    if (kind === "request_trailers" || kind === "response_trailers") {
      call.write({ [kind]: {} });
    }
  });
  call.on("end", () => call.end());
  call.on("error", (error) => console.error(error.message));
}

const server = new grpc.Server();
server.addService(proto.ExternalProcessor.service, { Process: processCall });
server.bindAsync("0.0.0.0:9000", grpc.ServerCredentials.createInsecure(), (error, port) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`ext_proc listening on ${port}`);
});
