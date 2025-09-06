import * as vscode from 'vscode';
import { DebugStackFrameInternal } from '../interfaces/DebugTypes';

const isWindows = process.platform === 'win32';

export function normalizePath(path: string): string {
    return isWindows ? path.toLowerCase() : path;
}

export class ExecutedLinesTracker {
    private executedLines: Map<string, Set<number>> = new Map();

    async updateExecutedLines(session: vscode.DebugSession, document: vscode.TextDocument) {
        try {
            const threads = await session.customRequest('threads');
            if (!threads?.threads?.length) {
                return;
            }

            const threadId = threads.threads[0].id;
            const stackTrace = await session.customRequest('stackTrace', {
                threadId: threadId,
                startFrame: 0,
                levels: 20
            });

            if (!stackTrace?.stackFrames?.length) {
                return;
            }

            const normalizedDocPath = normalizePath(document.uri.fsPath);
            const currentFrame = (stackTrace.stackFrames as DebugStackFrameInternal[]).find(
                frame => frame.source?.path && normalizePath(frame.source.path) === normalizedDocPath
            );

            if (currentFrame) {
                const currentLine = currentFrame.line - 1;
                const currentFile = normalizedDocPath;

                this.executedLines.clear();

                let fileLines = this.executedLines.get(currentFile);
                if (!fileLines) {
                    fileLines = new Set<number>();
                    this.executedLines.set(currentFile, fileLines);
                }

                for (let line = 0; line < currentLine; line++) {
                    fileLines.add(line);
                }
            }
        } catch (error) {
            console.error('Error updating executed lines:', error);
        }
    }

    hasLineBeenExecuted(filePath: string, lineNumber: number): boolean {
        const normalizedPath = normalizePath(filePath);
        const fileLines = this.executedLines.get(normalizedPath);
        return fileLines ? fileLines.has(lineNumber) : false;
    }
}
