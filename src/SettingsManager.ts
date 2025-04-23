import { Plugin } from "obsidian";


export interface WhisperSettings {
	// API key settings
	whisperApiKey: string;
	openAiApiKey: string;
	geminiApiKey: string;
	anthropicApiKey: string;

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
	keepOriginalTranscription: boolean;

	// Silence removal settings
	useSilenceRemoval: boolean;
	silenceThreshold: number;  // in dB
	silenceDuration: number;   // in seconds
	silenceRemoveAll: boolean; // whether to remove all silence periods
}

export const DEFAULT_SETTINGS: WhisperSettings = {
	whisperApiKey: "",
	openAiApiKey: "",
	geminiApiKey: "",
	anthropicApiKey: "",
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
	postProcessingPrompt: "You are a perfect transcription program that is able to take faulty dictations and put them into a readable, grammatically correct form without changing their content or changing their specific formulations. It is important that you leave formulations as they are, and make no attempts to formalize or professionalize them. Always return as much of the content as possible. If there are repetions of content, choose the best (often last) one and make the sentence work with that. Just return the dictation, do not comment on it, or introduce it. Always transcribe in the language of the dictation. Here comes the dictation: \n\n",
	postProcessingModel: "gpt-4.1-mini",
	autoGenerateTitle: false,
	titleGenerationPrompt: "You are an intelligent bureaucratic assistant. You are tasked with generating a short (1-5 words), precise title for the TEXT below. Reply only with the title, nothing else. Generate the title in the main language of the TEXT. TEXT:",
	keepOriginalTranscription: false,

	// Default silence removal settings
	useSilenceRemoval: false,
	silenceThreshold: -30,
	silenceDuration: 2,
	silenceRemoveAll: true,
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
