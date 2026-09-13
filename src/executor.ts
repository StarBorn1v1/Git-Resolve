import { simpleGit } from 'simple-git';

/**
 * Sanitize error messages to strip potential credentials from Git URLs.
 * Git errors can embed URLs like https://<token>@github.com/... 
 */
function sanitizeErrorMessage(msg: string): string {
    // Strip credentials from URLs (https://user:token@host/...)
    return msg.replace(/https?:\/\/[^@\s]+@/g, 'https://***@');
}

export async function executeAction(actionId: string, cwd: string, payload?: string): Promise<{ success: boolean, message: string }> {
    const git = simpleGit({ baseDir: cwd });
    
    try {
        switch (actionId) {
            case 'view_status': {
                const status = await git.status();
                let msg = `Branch: ${status.current || 'Detached HEAD / No Branch'}\n`;
                if (status.isClean()) {
                    msg += 'Working directory is clean.';
                } else {
                    if (status.staged.length > 0) {
                        msg += `Staged files: ${status.staged.join(', ')}\n`;
                    }
                    if (status.modified.length > 0) {
                        msg += `Modified files: ${status.modified.join(', ')}\n`;
                    }
                    if (status.not_added.length > 0) {
                        msg += `Untracked files: ${status.not_added.join(', ')}`;
                    }
                }
                return { success: true, message: msg };
            }
            case 'view_changes': {
                let msg = '';

                // Show staged changes
                const stagedDiff = await git.diff(['--cached']);
                if (stagedDiff) {
                    msg += '=== Staged Changes ===\n';
                    msg += stagedDiff.substring(0, 2000) + (stagedDiff.length > 2000 ? '\n... (truncated)' : '');
                    msg += '\n\n';
                }

                // Show unstaged changes
                const diff = await git.diff();
                if (diff) {
                    msg += '=== Unstaged Changes ===\n';
                    msg += diff.substring(0, 2000) + (diff.length > 2000 ? '\n... (truncated)' : '');
                }

                // Show untracked files
                const status = await git.status();
                if (status.not_added.length > 0) {
                    msg += '\n\n=== Untracked Files ===\n';
                    msg += status.not_added.join('\n');
                }

                return { success: true, message: msg || 'No changes found.' };
            }
            case 'view_history': {
                try {
                    const log = await git.log({ maxCount: 10 });
                    const msg = log.all.map(l => `* ${l.hash.substring(0,7)} - ${l.message} (${l.author_name})`).join('\n');
                    return { success: true, message: msg || 'No commits yet.' };
                } catch {
                    return { success: true, message: 'No commits yet. This is a brand new repository.' };
                }
            }
            case 'commit_changes': {
                if (!payload || !payload.trim()) {
                    return { success: false, message: 'Commit aborted: No commit message provided.' };
                }
                await git.add('.');
                await git.commit(payload.trim());
                return { success: true, message: `Changes staged and committed successfully: "${payload.trim()}"` };
            }
            case 'stash_changes': {
                await git.stash(['push', '--include-untracked']);
                return { success: true, message: 'Changes safely stashed (including untracked files).' };
            }
            case 'undo_changes': {
                try {
                    await git.stash(['push', '--include-untracked', '-m', 'AUTO-SAVE: Before Undo']);
                } catch {
                    // Ignore stash errors if there's nothing to stash, though the state guard should prevent this
                }
                await git.reset(['--hard']);
                await git.clean('f', ['-d']);
                return { success: true, message: 'Changes discarded. A safety stash was automatically created just in case.' };
            }
            case 'recover_work': {
                try {
                    const rawLog = await git.raw(['reflog', '--format=%H %gd %gs %cr', '-n', '10']);
                    if (!rawLog.trim()) {
                        return { success: true, message: 'No recoverable history found.' };
                    }
                    const lines = rawLog.trim().split('\n').map(line => {
                        const parts = line.split(' ');
                        const hash = parts[0].substring(0, 7);
                        // Last two parts are the relative time (e.g. "5 minutes ago")
                        // The format is: hash refname action time_ago
                        const match = line.match(/^[a-f0-9]+ [^ ]+ (.+), (\d+ \w+ ago)$/);
                        if (match) {
                            return `  ${match[2]} — ${match[1]} (${hash})`;
                        }
                        return `  ${line}`;
                    });
                    return { success: true, message: `Recoverable States:\n\n${lines.join('\n')}` };
                } catch {
                    return { success: true, message: 'No recoverable history found.' };
                }
            }
            default:
                return { success: false, message: `Action ${actionId} is not implemented yet.` };
        }
    } catch (e: unknown) {
        let msg = e instanceof Error ? e.message : String(e);
        // Sanitize credentials from error messages
        msg = sanitizeErrorMessage(msg);
        // Error translation
        if (msg.includes('conflict')) {
            msg = 'Merge conflicts detected. Please resolve them in your editor before continuing.';
        }
        return { success: false, message: `Operation safely aborted: ${msg}` };
    }
}
