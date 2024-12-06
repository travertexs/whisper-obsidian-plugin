import { Plugin } from "obsidian";


export interface WhisperSettings {
	apiKey: string;
	apiUrl: string;
	model: string;
	prompt: string;
	language: string;
	saveAudioFile: boolean;
	saveAudioFilePath: string;
	debugMode: boolean;
	createNewFileAfterRecording: boolean;
	createNewFileAfterRecordingPath: string;

	// New fields:
	usePostProcessing: boolean;              // (1) Use postprocessing
	postProcessingPrompt: string;           // (2) Post-processing prompt
	postProcessingModel: string;            // (3) Model dropdown
	autoGenerateTitle: boolean;             // (4) Auto generate title
	titleGenerationPrompt: string;          // (5) Title-generation prompt
}

export const DEFAULT_SETTINGS: WhisperSettings = {
	apiKey: "",
	apiUrl: "https://api.openai.com/v1/audio/transcriptions",
	model: "whisper-1",
	prompt: "",
	language: "en",
	saveAudioFile: true,
	saveAudioFilePath: "",
	debugMode: false,
	createNewFileAfterRecording: true,
	createNewFileAfterRecordingPath: "",

	// Set defaults for new settings
	usePostProcessing: false,
	postProcessingPrompt: "You are a perfect transcription program that is able to take faulty dictations and put them into a readable, grammatically correct form without changing their content or changing their specific formulations. It is important that you leave formulations as they are, and make no attempts to formalize or professionalize them. If there are repetions of content, choose the best (often last) one and make the sentence work with that.",
	postProcessingModel: "gpt-4",
	autoGenerateTitle: false,
	titleGenerationPrompt: "Generate a short title for the following text:"
};

export class SettingsManager {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async loadSettings(): Promise<WhisperSettings> {
		return Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.plugin.loadData()
		);
	}

	async saveSettings(settings: WhisperSettings): Promise<void> {
		await this.plugin.saveData(settings);
	}
}
