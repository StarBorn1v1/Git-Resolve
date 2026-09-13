import { RepoState } from './git';

export interface Action {
    id: string;
    label: string;
    description: string;
    riskLevel: 'safe' | 'warning' | 'destructive';
    isEnabled: (state: RepoState) => boolean;
    getDisabledReason?: (state: RepoState) => string;
}

export const ALL_ACTIONS: Action[] = [
    {
        id: 'view_status',
        label: 'View status',
        description: 'Check the current state of your repository.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo,
    },
    {
        id: 'view_changes',
        label: 'View changes',
        description: 'See the exact changes made in modified files.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
        getDisabledReason: (state) => 'Working directory is clean.',
    },
    {
        id: 'view_history',
        label: 'View history',
        description: 'See recent commits.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo,
    },
    {
        id: 'commit_changes',
        label: 'Commit changes',
        description: 'Save your changes to history.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo && (state.staged > 0 || state.modified > 0 || state.untracked > 0),
        getDisabledReason: (state) => 'No changes to commit.',
    },
    {
        id: 'stash_changes',
        label: 'Stash changes',
        description: 'Set aside uncommitted changes temporarily.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
        getDisabledReason: (state) => 'Working directory is clean.',
    },
    {
        id: 'undo_changes',
        label: 'Undo changes',
        description: 'Discard uncommitted changes. This cannot be easily reversed.',
        riskLevel: 'destructive',
        isEnabled: (state) => state.isRepo && !state.isClean,
        getDisabledReason: (state) => 'No changes to undo.',
    },
    {
        id: 'recover_work',
        label: 'Recover lost work',
        description: 'Look through Git reflog to find and recover lost commits or states.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo,
    },
    {
        id: 'sync_remote',
        label: 'Sync with remote (Pull/Push)',
        description: 'Pull new changes and push your local commits.',
        riskLevel: 'warning',
        isEnabled: (state) => state.isRepo && !!state.branch,
    },
    {
        id: 'change_theme',
        label: 'Change Theme',
        description: 'Switch application color theme.',
        riskLevel: 'safe',
        isEnabled: () => true,
    }
];

export function getAvailableActions(state: RepoState): Action[] {
    return ALL_ACTIONS;
}
