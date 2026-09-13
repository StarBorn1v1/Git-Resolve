import { RepoState } from './git';

export interface Action {
    id: string;
    label: string;
    description: string;
    riskLevel: 'safe' | 'warning' | 'destructive';
    isEnabled: (state: RepoState) => boolean;
    getDisabledReason?: (state: RepoState) => string;
    requiresInput?: {
        prompt: string;
        placeholder?: string;
    };
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
        getDisabledReason: () => 'Working directory is clean.',
    },
    {
        id: 'commit_changes',
        label: 'Commit changes',
        description: 'Stage all current changes and save them to history.',
        riskLevel: 'warning',
        isEnabled: (state) => state.isRepo && (state.staged > 0 || state.modified > 0 || state.untracked > 0),
        getDisabledReason: () => 'No changes to commit.',
        requiresInput: {
            prompt: 'Enter a commit message:',
            placeholder: 'Fix the flux capacitor...',
        },
    },
    {
        id: 'view_history',
        label: 'View history',
        description: 'See recent commits.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo,
    },
    {
        id: 'stash_changes',
        label: 'Stash changes',
        description: 'Set aside all uncommitted changes (including untracked files) temporarily.',
        riskLevel: 'warning',
        isEnabled: (state) => state.isRepo && (!state.isClean || state.untracked > 0),
        getDisabledReason: () => 'Working directory is clean.',
    },
    {
        id: 'undo_changes',
        label: 'Undo changes',
        description: 'Discard uncommitted changes. This cannot be easily reversed.',
        riskLevel: 'destructive',
        isEnabled: (state) => state.isRepo && !state.isClean,
        getDisabledReason: () => 'No changes to undo.',
    },
    {
        id: 'recover_work',
        label: 'Recover lost work',
        description: 'Look through recent history to find and recover lost commits or states.',
        riskLevel: 'safe',
        isEnabled: (state) => state.isRepo,
    },
    {
        id: 'change_theme',
        label: 'Change Theme',
        description: 'Switch application color theme.',
        riskLevel: 'safe',
        isEnabled: () => true,
    }
];
