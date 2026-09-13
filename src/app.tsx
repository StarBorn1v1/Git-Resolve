import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { getRepoState, RepoState } from './git';
import { ALL_ACTIONS, Action } from './actions';
import { executeAction } from './executor';

const THEMES = {
	classic: { border: 'blue', text: 'cyan', highlight: 'yellow', success: 'green', textDim: 'gray' },
	midnight: { border: 'magenta', text: 'magentaBright', highlight: 'white', success: 'magenta', textDim: 'gray' },
	amber: { border: 'yellow', text: 'yellowBright', highlight: 'yellow', success: 'yellowBright', textDim: 'yellow' },
	matrix: { border: 'green', text: 'greenBright', highlight: 'green', success: 'greenBright', textDim: 'green' },
};

const ASCII_HEADER = `
  ____ _ _     ____                _           
 / ___(_) |_  |  _ \\ ___  ___  ___| |_   _____ 
| |  _| | __| | |_) / _ \\/ __|/ _ \\ \\ \\ / / _ \\
| |_| | | |_  |  _ <  __/\\__ \\ (_) | \\ V /  __/
 \\____|_|\\__| |_| \\_\\___||___/\\___/|_|\\_/ \\___|
`;

const App = () => {
	const [state, setState] = useState<RepoState | null>(null);
	const [loading, setLoading] = useState(true);
	
	const [screen, setScreen] = useState<'main' | 'briefing' | 'executing' | 'result' | 'themes'>('main');
	const [selectedAction, setSelectedAction] = useState<Action | null>(null);
	const [resultMsg, setResultMsg] = useState('');
	const [activityRail, setActivityRail] = useState<string[]>([]);
	const [themeName, setThemeName] = useState<keyof typeof THEMES>('classic');

	const theme = THEMES[themeName];

	const refreshState = async () => {
		setLoading(true);
		const s = await getRepoState(process.cwd());
		setState(s);
		setLoading(false);
	};

	useEffect(() => {
		refreshState();
	}, []);

	useInput((input, key) => {
		if (screen === 'result' && (key.return || input === ' ')) {
			setScreen('main');
		} else if (screen === 'briefing') {
			if (input.toLowerCase() === 'y') {
				executeSelected();
			} else if (input.toLowerCase() === 'n' || key.escape) {
				setScreen('main');
			}
		}
	});

	const handleSelect = (item: {label: string, value: string}) => {
		if (item.value === 'exit') {
			process.exit(0);
		}
		if (item.value === 'change_theme') {
			setScreen('themes');
			return;
		}

		const action = ALL_ACTIONS.find(a => a.id === item.value);
		if (action) {
			if (!action.isEnabled(state!)) {
				return;
			}
			setSelectedAction(action);
			if (action.riskLevel === 'safe') {
				executeSelectedAction(action);
			} else {
				setScreen('briefing');
			}
		}
	};

	const handleThemeSelect = (item: {value: string}) => {
		setThemeName(item.value as keyof typeof THEMES);
		setScreen('main');
	};

	const executeSelectedAction = async (action: Action) => {
		setScreen('executing');
		const res = await executeAction(action.id, process.cwd());
		setResultMsg(res.message);
		
		setActivityRail(prev => [...prev, `✓ ${action.label}`]);
		
		await refreshState();
		setScreen('result');
	};

	const executeSelected = () => {
		if (selectedAction) {
			executeSelectedAction(selectedAction);
		}
	};

	if (loading && screen === 'main') {
		return <Text color={theme.text}>Loading repository state...</Text>;
	}

	if (!state || !state.isRepo) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Error: Not a git repository.</Text>
				<Text color={theme.text}>Please run git-resolve from within a Git project.</Text>
			</Box>
		);
	}

	if (screen === 'themes') {
		const themeItems = Object.keys(THEMES).map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }));
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color={theme.text}>SELECT THEME</Text>
				<Box marginTop={1}>
					<SelectInput items={themeItems} onSelect={handleThemeSelect} />
				</Box>
			</Box>
		);
	}

	if (screen === 'briefing' && selectedAction) {
		return (
			<Box flexDirection="column" padding={1} borderStyle="single" borderColor={theme.highlight as any}>
				<Text bold color={theme.highlight as any}>BRIEFING: {selectedAction.label.toUpperCase()}</Text>
				<Box marginTop={1} marginBottom={1}>
					<Text color={theme.text as any}>{selectedAction.description}</Text>
				</Box>
				<Text color={theme.text as any}>Continue? (y/N)</Text>
			</Box>
		);
	}

	if (screen === 'executing') {
		return <Box padding={1}><Text color={theme.text as any}>Executing...</Text></Box>;
	}

	if (screen === 'result') {
		return (
			<Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.success as any}>
				<Text bold color={theme.success as any}>RESULT</Text>
				<Box marginTop={1} marginBottom={1}>
					<Text color={theme.text as any}>{resultMsg}</Text>
				</Box>
				<Text color={theme.textDim as any}>Press Enter to return to menu</Text>
			</Box>
		);
	}

	const items = ALL_ACTIONS.map(a => {
		const enabled = a.isEnabled(state);
		const label = enabled ? a.label : `${a.label} (Unavailable: ${a.getDisabledReason ? a.getDisabledReason(state) : 'Not applicable'})`;
		return { label, value: a.id };
	});
	items.push({ label: 'Exit', value: 'exit' });

	return (
		<Box padding={1}>
			<Box flexDirection="column" flexGrow={1} paddingRight={2}>
				<Text color={theme.text as any}>{ASCII_HEADER}</Text>
				<Box borderStyle="single" borderColor={theme.border as any} padding={1} marginBottom={1} flexDirection="column">
					<Text>Project: {state.repoRoot}</Text>
					<Text>Branch:  {state.branch}</Text>
					<Text>Status:  {state.isClean ? 'Clean' : `${state.modified} modified, ${state.staged} staged, ${state.untracked} untracked`}</Text>
				</Box>
				
				<Text bold color={theme.text as any}>SELECT ACTION</Text>
				<Box marginTop={1}>
					<SelectInput items={items} onSelect={handleSelect} />
				</Box>
			</Box>

			{/* Activity Rail */}
			<Box flexDirection="column" width={30} borderStyle="single" borderColor={theme.border as any} paddingLeft={1}>
				<Text bold underline color={theme.text as any}>ACTIVITY</Text>
				{activityRail.length === 0 && <Text color={theme.textDim as any}>No recent activity</Text>}
				{activityRail.map((act, i) => (
					<Text key={i} color={theme.success as any}>{act}</Text>
				))}
			</Box>
		</Box>
	);
};

export default App;
