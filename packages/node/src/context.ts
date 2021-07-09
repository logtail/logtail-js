import { Context } from "@logtail/types";
import { dirname, relative } from "path";
import stackTrace, { StackFrame } from 'stack-trace';
import { Node } from "./node";

/**
 * Determines the file name and the line number from which the log
 * was initiated (if we're able to tell).
 *
 * @returns Context The caller's filename and the line number
 */
export function getStackContext(logtail: Node): Context {
  const stackFrame = getCallingFrame(logtail);
  if (stackFrame === null) return {};

  return {
    context: {
      runtime: {
        file: relativeToMainModule(stackFrame.getFileName()),
        type: stackFrame.getTypeName(),
        method: stackFrame.getMethodName(),
        function: stackFrame.getFunctionName(),
        line: stackFrame.getLineNumber(),
        column: stackFrame.getColumnNumber(),
      },
      system: {
        pid: process.pid,
        main_file: mainFileName()
      }
    }
  };
}

function getCallingFrame(logtail: Node): StackFrame | null {
  for (let fn of [logtail.warn, logtail.error, logtail.info, logtail.log]) {
    const stack = stackTrace.get(fn as any);
    if (stack.length > 0) return stack[0];
  }

  return null;
}

function relativeToMainModule(fileName: string): string | null {
  if (typeof(fileName) !== "string") {
    return null;
  } else if (fileName.startsWith("file:/")) {
    const url = new URL(fileName);
    return url.pathname;
  } else {
    const rootPath = dirname(mainFileName());
    return relative(rootPath, fileName);
  }
}

function mainFileName(): string {
  return require?.main?.filename ?? '';
}
