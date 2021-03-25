import { Context } from "@logtail/types";
import { dirname, relative } from "path";
import stackTrace, { StackFrame } from 'stack-trace';

/**
 * Determines the file name and the line number from which the log
 * was initiated (if we're able to tell).
 *
 * @returns Context The caller's filename and the line number
 */
export function getStackContext(): Context {
  const stackFrame = getCallingFrame();
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

function getCallingFrame(): StackFrame | null {
  const stack = stackTrace.get();
  if (stack === null) return null;

  const logtailTypeName = stack[0].getTypeName();
  for (let frame of stack) {
    if (frame.getTypeName() !== logtailTypeName) return frame;
  }

  return null;
}

function relativeToMainModule(fileName: string): string {
  if (fileName.startsWith("file:/")) {
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
