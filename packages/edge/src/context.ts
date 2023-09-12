import { Context } from "@logtail/types";
import stackTrace, { StackFrame } from "stack-trace";
import { Edge } from "./edge";

/**
 * Determines the file name and the line number from which the log
 * was initiated (if we're able to tell).
 *
 * @returns Context The caller's filename and the line number
 */
export function getStackContext(logtail: Edge): Context {
  const stackFrame = getCallingFrame(logtail);
  if (stackFrame === null) return {};

  return {
    context: {
      runtime: {
        file: stackFrame.getFileName(),
        type: stackFrame.getTypeName(),
        method: stackFrame.getMethodName(),
        function: stackFrame.getFunctionName(),
        line: stackFrame.getLineNumber(),
        column: stackFrame.getColumnNumber(),
      },
    },
  };
}

function getCallingFrame(logtail: Edge): StackFrame | null {
  for (let fn of [
    logtail.warn,
    logtail.error,
    logtail.info,
    logtail.debug,
    logtail.log,
  ]) {
    const stack = stackTrace.get(fn as any);
    if (stack.length > 0) return getRelevantStackFrame(stack);
  }

  return null;
}

function getRelevantStackFrame(frames: StackFrame[]): StackFrame {
  let reversedFrames = frames.reverse();
  let index = reversedFrames.findIndex(
    frame => frame.getTypeName() === "EdgeWithExecutionContext",
  );

  if (index > 0) return reversedFrames[index - 1];

  return frames[0];
}
