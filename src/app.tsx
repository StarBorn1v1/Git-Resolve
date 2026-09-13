import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import fs from 'fs';
import path from 'path';
import { getRepoState, RepoState } from './git';
import { ALL_ACTIONS, Action } from './actions';
import { executeAction } from './executor';

// Attempt to load the hero pixel art if it exists
let HERO_ANSI = '';
try {
	HERO_ANSI = fs.readFileSync(path.join(process.cwd(), 'assets', 'hero.ans'), 'utf8');
} catch (e) {
	// Silently fallback if it doesn't exist
}

const THEMES = {
	classic: { border: 'blue', text: 'cyan', highlight: 'yellow', success: 'green', error: 'red', textDim: 'gray' },
	midnight: { border: 'magenta', text: 'magentaBright', highlight: 'white', success: 'magenta', error: 'red', textDim: 'gray' },
	amber: { border: 'yellow', text: 'yellowBright', highlight: 'yellow', success: 'yellowBright', error: 'red', textDim: 'yellow' },
	matrix: { border: 'green', text: 'greenBright', highlight: 'green', success: 'greenBright', error: 'red', textDim: 'green' },
	monochrome: { border: 'white', text: 'whiteBright', highlight: 'white', success: 'whiteBright', error: 'gray', textDim: 'gray' },
	synthwave: { border: 'magenta', text: 'cyanBright', highlight: 'magentaBright', success: 'cyan', error: 'redBright', textDim: 'magenta' },
	ocean: { border: 'blue', text: 'blueBright', highlight: 'cyanBright', success: 'cyan', error: 'red', textDim: 'blue' },
	dracula: { border: 'magenta', text: 'white', highlight: 'magentaBright', success: 'greenBright', error: 'redBright', textDim: 'gray' },
	sunset: { border: 'red', text: 'yellowBright', highlight: 'redBright', success: 'yellow', error: 'red', textDim: 'red' },
} as const;

type ThemeName = keyof typeof THEMES;

const ASCII_HEADER = `
  ____ _ _     ____                _           
 / ___(_) |_  |  _ \\ ___  ___  ___| |_   _____ 
| |  _| | __| | |_) / _ \\/ __|/ _ \\ \\ \\ / / _ \\
| |_| | | |_  |  _ <  __/\\__ \\ (_) | \\ V /  __/
 \\____|_|\\__| |_| \\_\\___||___/\\___/|_|\\_/ \\___|
`;

const App = () => {
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState({
		columns: stdout.columns || 80,
		rows: stdout.rows || 24
	});

	const [state, setState] = useState<RepoState | null>(null);
	const [loading, setLoading] = useState(true);
	
	const [screen, setScreen] = useState<'main' | 'briefing' | 'input' | 'executing' | 'result' | 'themes'>('main');
	const [selectedAction, setSelectedAction] = useState<Action | null>(null);
	const [resultMsg, setResultMsg] = useState('');
	const [resultSuccess, setResultSuccess] = useState(true);
	const [activityRail, setActivityRail] = useState<string[]>([]);
	const [themeName, setThemeName] = useState<ThemeName>('classic');
	const [inputText, setInputText] = useState('');

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

	useEffect(() => {
		let timeout: NodeJS.Timeout;
		const onResize = () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				setDimensions({
					columns: stdout.columns || 80,
					rows: stdout.rows || 24
				});
			}, 50); // Debounce rapid resizes
		};
		stdout.on('resize', onResize);
		return () => {
			clearTimeout(timeout);
			stdout.off('resize', onResize);
		};
	}, [stdout]);

	useInput((input, key) => {
		if (screen === 'result' && (key.return || input === ' ')) {
			setScreen('main');
		} else if (screen === 'briefing') {
			if (input.toLowerCase() === 'y') {
				if (selectedAction?.requiresInput) {
					setScreen('input');
					setInputText('');
				} else {
					executeSelected();
				}
			} else if (input.toLowerCase() === 'n' || key.escape) {
				setScreen('main');
			}
		} else if (screen === 'themes') {
			if (key.escape) {
				setScreen('main');
			}
		} else if (screen === 'input') {
			if (key.escape) {
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
				if (action.requiresInput) {
					setScreen('input');
					setInputText('');
				} else {
					executeSelectedAction(action);
				}
			} else {
				setScreen('briefing');
			}
		}
	};

	const handleThemeSelect = (item: {value: string}) => {
		setThemeName(item.value as ThemeName);
		setScreen('main');
	};

	const executeSelectedAction = async (action: Action, payload?: string) => {
		setScreen('executing');
		try {
			const res = await executeAction(action.id, process.cwd(), payload);
			setResultMsg(res.message);
			setResultSuccess(res.success);
			
			// Only record successful actions in the activity rail
			if (res.success) {
				setActivityRail(prev => [...prev, `✓ ${action.label}`]);
			} else {
				setActivityRail(prev => [...prev, `✗ ${action.label}`]);
			}
			
			await refreshState();
			setScreen('result');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setResultMsg(`Unexpected error: ${msg}`);
			setResultSuccess(false);
			setActivityRail(prev => [...prev, `✗ ${action.label}`]);
			setScreen('result');
		}
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
			<Box flexDirection="column" padding={1} borderStyle="single" borderColor={theme.border} alignSelf="flex-start">
				<Text bold color={theme.text}>SELECT THEME</Text>
				<Text color={theme.textDim}>Press Esc to cancel</Text>
				<Box marginTop={1}>
					<SelectInput items={themeItems} onSelect={handleThemeSelect} />
				</Box>
			</Box>
		);
	}

	if (screen === 'briefing' && selectedAction) {
		let briefingDetails = '';
		if (['commit_changes', 'undo_changes', 'stash_changes'].includes(selectedAction.id) && state) {
			briefingDetails = `Files affected: ${state.staged} staged, ${state.modified} modified, ${state.untracked} untracked`;
		}

		return (
			<Box flexDirection="column" padding={1} borderStyle="single" borderColor={theme.highlight} alignSelf="flex-start">
				<Text bold color={theme.highlight}>BRIEFING: {selectedAction.label.toUpperCase()}</Text>
				<Box marginTop={1} marginBottom={1} flexDirection="column">
					<Text color={theme.text}>{selectedAction.description}</Text>
					{briefingDetails && <Text color={theme.textDim}>{briefingDetails}</Text>}
				</Box>
				<Text color={theme.text}>Continue? (y/N)</Text>
			</Box>
		);
	}

	if (screen === 'input' && selectedAction?.requiresInput) {
		return (
			<Box flexDirection="column" padding={1} borderStyle="single" borderColor={theme.highlight} alignSelf="flex-start">
				<Text bold color={theme.highlight}>{selectedAction.requiresInput.prompt.toUpperCase()}</Text>
				<Box marginTop={1} marginBottom={1}>
					<TextInput
						value={inputText}
						onChange={setInputText}
						onSubmit={(val) => executeSelectedAction(selectedAction, val)}
						placeholder={selectedAction.requiresInput.placeholder}
					/>
				</Box>
				<Text color={theme.textDim}>Press Enter to submit, Esc to cancel</Text>
			</Box>
		);
	}

	if (screen === 'executing') {
		return <Box padding={1}><Text color={theme.text}>Executing...</Text></Box>;
	}

	if (screen === 'result') {
		const borderColor = resultSuccess ? theme.success : theme.error;
		const headerText = resultSuccess ? 'RESULT' : 'ACTION COULD NOT BE COMPLETED';
		return (
			<Box flexDirection="column" padding={1} borderStyle="round" borderColor={borderColor} alignSelf="flex-start">
				<Text bold color={borderColor}>{headerText}</Text>
				<Box marginTop={1} marginBottom={1}>
					<Text color={theme.text}>{resultMsg}</Text>
				</Box>
				<Text color={theme.textDim}>Press Enter to return to menu</Text>
			</Box>
		);
	}

	const items = ALL_ACTIONS.map(a => {
		const enabled = a.isEnabled(state);
		const label = enabled ? a.label : `${a.label} (Unavailable: ${a.getDisabledReason ? a.getDisabledReason(state) : 'Not applicable'})`;
		return { label, value: a.id };
	});
	items.push({ label: 'Exit', value: 'exit' });

	const showHeroAndRail = dimensions.columns >= 130 && dimensions.rows >= 35;
	const showAsciiHeader = dimensions.columns >= 75 && dimensions.rows >= 20;

	return (
		<Box padding={1} flexDirection="column" alignSelf="flex-start">
			{/* Top Header Row */}
			<Box flexDirection="row" alignItems="center" marginBottom={1}>
				{showHeroAndRail && HERO_ANSI ? (
					<Box marginRight={2}>
						<Text wrap="none">{HERO_ANSI}</Text>
					</Box>
				) : null}
				{showAsciiHeader ? (
					<Box>
						<Text bold color={theme.highlight}>{ASCII_HEADER}</Text>
					</Box>
				) : (
					<Box marginBottom={1}>
						<Text bold color={theme.highlight}>=== GIT RESOLVE ===</Text>
					</Box>
				)}
			</Box>

			{/* Main Content Columns */}
			<Box flexDirection="row">
				{/* Left Column (Menu & Status) */}
				<Box flexDirection="column" paddingRight={showHeroAndRail ? 2 : 0}>
					<Box borderStyle="single" borderColor={theme.border} padding={1} marginBottom={1} flexDirection="column" alignSelf="flex-start">
						<Text>Project: {state.repoRoot}</Text>
						<Text>Branch:  {state.branch}</Text>
						<Text>Status:  {state.isClean ? 'Clean' : `${state.modified} modified, ${state.staged} staged, ${state.untracked} untracked`}</Text>
					</Box>
					
					<Text bold color={theme.text}>SELECT ACTION</Text>
					<Box marginTop={1}>
						<SelectInput items={items} onSelect={handleSelect} />
					</Box>
				</Box>

				{/* Right Column (Activity Rail) */}
				{showHeroAndRail && (
					<Box flexDirection="column" minWidth={30} borderStyle="single" borderColor={theme.border} paddingLeft={1} alignSelf="flex-start">
						<Text bold underline color={theme.text}>ACTIVITY</Text>
						{activityRail.length === 0 && <Text color={theme.textDim}>No recent activity</Text>}
						{activityRail.map((act, i) => (
							<Text key={i} color={act.startsWith('✓') ? theme.success : theme.error}>{act}</Text>
						))}
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default App;
