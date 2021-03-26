var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var stream_1 = require("stream");
// import Msgpack from "msgpack5";
var types_1 = require("@logtail/types");
var core_1 = require("@logtail/core");
// Namespace the msgpack library
// const msgpack = Msgpack();
var Node = (function (_super) {
    __extends(Node, _super);
    function Node(sourceToken, options) {
        _super.call(this, sourceToken, options);
        /**
         * Override `Base` log to enable Node.js streaming
         *
         * @param message: string - Log message
         * @param level (LogLevel) - Level to log at (debug|info|warn|error)
         * @param log: (Partial<ILogtailLog>) - Initial log (optional)
         * @returns Promise<ILogtailLog> after syncing
         */
        this.async = log(message, string, level ?  : types_1.LogLevel, context, TContext = {}, as, TContext);
        // Sync function
        var sync = async(logs, types_1.ILogtailLog[]), Promise = ;
        {
            var res = await, fetch_1 = (this._options.endpoint,
                {
                    method: "POST",
                    headers: {
                        // "Content-Type": "application/msgpack",
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + this._sourceToken,
                        "User-Agent": "logtail-js(node)"
                    },
                    // body: logs.map(log => `${log.level}: ${log.message}`).join("\n")
                    // body: msgpack.encode(logsWithSchema).slice()
                    // TODO - using JSON for now; switch to msgpack later
                    body: JSON.stringify(logs)
                });
            if (res.ok) {
                return logs;
            }
            /**
             * TODO: if status is 50x throw custom ServerError
             * to be used in retry logic
             */
            throw new Error(res.statusText);
        }
        ;
        // Set the throttled sync function
        this.setSync(sync);
    }
    return Node;
})(core_1.Base);
exports.Node = Node;
{
    // Process/sync the log, per `Base` logic
    var processedLog = await;
    _super.log.call(this, message, level, context);
    // Push the processed log to the stream, for piping
    if (this._writeStream) {
        this._writeStream.write(JSON.stringify(processedLog) + "\n");
    }
    // Return the transformed log
    return processedLog;
    as;
    types_1.ILogtailLog & TContext;
}
pipe(stream, stream_1.Writable | stream_1.Duplex);
{
    this._writeStream = stream;
    return stream;
}
