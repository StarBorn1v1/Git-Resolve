import { simpleGit, SimpleGit } from 'simple-git';

export interface RepoState {
    isRepo: boolean;
    repoRoot: string | null;
    branch: string | null;
    isClean: boolean;
    ahead: number;
    behind: number;
    conflicted: boolean;
    untracked: number;
    modified: number;
    staged: number;
}

export async function getRepoState(cwd: string): Promise<RepoState> {
    const git: SimpleGit = simpleGit({ baseDir: cwd });
    
    try {
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            return {
                isRepo: false,
                repoRoot: null,
                branch: null,
                isClean: true,
                ahead: 0,
                behind: 0,
                conflicted: false,
                untracked: 0,
                modified: 0,
                staged: 0,
            };
        }

        const repoRoot = await git.revparse(['--show-toplevel']);
        const status = await git.status();

        return {
            isRepo: true,
            repoRoot,
            branch: status.current,
            isClean: status.isClean(),
            ahead: status.ahead,
            behind: status.behind,
            conflicted: status.conflicted.length > 0,
            untracked: status.not_added.length,
            modified: status.modified.length,
            staged: status.staged.length,
        };
    } catch (error) {
        return {
            isRepo: false,
            repoRoot: null,
            branch: null,
            isClean: true,
            ahead: 0,
            behind: 0,
            conflicted: false,
            untracked: 0,
            modified: 0,
            staged: 0,
        };
    }
}
