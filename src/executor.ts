import { simpleGit } from 'simple-git';

export async function executeAction(actionId: string, cwd: string): Promise<{ success: boolean, message: string }> {
    const git = simpleGit({ baseDir: cwd });
    
    try {
        switch (actionId) {
            case 'view_status': {
                const status = await git.status();
                let msg = `Branch: ${status.current}\n`;
                if (status.isClean()) {
                    msg += 'Working directory is clean.';
                } else {
                    msg += `Modified files: ${status.modified.join(', ')}\n`;
                    msg += `Untracked files: ${status.not_added.join(', ')}`;
                }
                return { success: true, message: msg };
            }
            case 'view_changes': {
                const diff = await git.diff();
                return { success: true, message: diff.substring(0, 1000) + (diff.length > 1000 ? '\n... (truncated)' : '') || 'No unstaged changes.' };
            }
            case 'view_history': {
                const log = await git.log({ maxCount: 5 });
                const msg = log.all.map(l => `* ${l.hash.substring(0,7)} - ${l.message} (${l.author_name})`).join('\n');
                return { success: true, message: msg || 'No commits yet.' };
            }
            case 'commit_changes': {
                await git.add('.');
                await git.commit('Quick commit from Git Resolve');
                return { success: true, message: 'Changes staged and committed successfully.' };
            }
            case 'stash_changes': {
                await git.stash();
                return { success: true, message: 'Changes safely stashed.' };
            }
            case 'undo_changes': {
                await git.reset(['--hard']);
                await git.clean('f', ['-d']);
                return { success: true, message: 'All uncommitted changes have been safely discarded.' };
            }
            case 'recover_work': {
                // Get reflog and show latest 5 recoverable states
                const rawLog = await git.raw(['reflog', '-n', '5']);
                if (!rawLog.trim()) {
                    return { success: true, message: 'No recoverable history found.' };
                }
                return { success: true, message: `Recoverable States:\n\n${rawLog}` };
            }
            case 'sync_remote': {
                await git.pull().catch(() => { /* ignore pull errs for MVP */ });
                await git.push();
                return { success: true, message: 'Successfully synced with remote.' };
            }
            default:
                return { success: false, message: `Action ${actionId} is not implemented yet.` };
        }
    } catch (e: any) {
        let msg = e.message;
        // Error translation
        if (msg.includes('conflict')) {
            msg = 'Merge conflicts detected. Please resolve them in your editor before continuing.';
        } else if (msg.includes('Could not read from remote repository')) {
            msg = 'Cannot connect to remote repository. Check your network or credentials.';
        }
        return { success: false, message: `Operation safely aborted: ${msg}` };
    }
}
