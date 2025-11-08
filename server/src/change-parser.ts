import { Change } from './types';

export class ChangeParser {
  /**
   * Parse Claude Code output for change proposals
   * Detects when Claude Code asks "Do you want to make this edit?"
   */
  parseChangeProposal(output: string, agentId: string, agentName: string, sessionId: string): Change | null {
    // Check if output contains edit confirmation prompt
    if (!output.includes('Do you want to make this edit')) {
      return null;
    }

    try {
      const change = this.extractDiff(output);
      if (!change) {
        return null;
      }

      return {
        id: this.generateId(),
        sessionId,
        agentId,
        agentName,
        filePath: change.filePath,
        before: change.before,
        after: change.after,
        status: 'pending',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to parse change proposal:', error);
      return null;
    }
  }

  /**
   * Extract file path and diff from output
   */
  private extractDiff(output: string): { filePath: string; before: string; after: string } | null {
    const lines = output.split('\n');

    // Look for file path patterns
    // Claude Code typically shows: "Edit src/components/Button.tsx:"
    let filePath = '';
    for (const line of lines) {
      const editMatch = line.match(/Edit\s+(.+?):/);
      if (editMatch) {
        filePath = editMatch[1].trim();
        break;
      }

      // Alternative patterns
      const fileMatch = line.match(/^[+\-]{3}\s+(.+?)$/);
      if (fileMatch && !filePath) {
        filePath = fileMatch[1].trim();
      }
    }

    if (!filePath) {
      return null;
    }

    // Extract before/after content from diff
    const { before, after } = this.parseDiffContent(lines);

    return { filePath, before, after };
  }

  /**
   * Parse unified diff format to extract before/after content
   */
  private parseDiffContent(lines: string[]): { before: string; after: string } {
    const beforeLines: string[] = [];
    const afterLines: string[] = [];
    let inDiff = false;

    for (const line of lines) {
      // Start of diff section (@@)
      if (line.startsWith('@@')) {
        inDiff = true;
        continue;
      }

      if (!inDiff) continue;

      // Stop if we hit confirmation prompt
      if (line.includes('Do you want to make this edit')) {
        break;
      }

      if (line.startsWith('-') && !line.startsWith('---')) {
        // Removed line
        beforeLines.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line
        afterLines.push(line.substring(1));
      } else if (!line.startsWith('\\')) {
        // Context line (appears in both)
        beforeLines.push(line.startsWith(' ') ? line.substring(1) : line);
        afterLines.push(line.startsWith(' ') ? line.substring(1) : line);
      }
    }

    return {
      before: beforeLines.join('\n'),
      after: afterLines.join('\n')
    };
  }

  /**
   * Generate unique ID for changes
   */
  private generateId(): string {
    return `change-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if output contains a confirmation prompt
   */
  hasConfirmationPrompt(output: string): boolean {
    return output.includes('Do you want to make this edit') ||
           output.includes('(y/n)') ||
           output.includes('Accept this change?');
  }
}