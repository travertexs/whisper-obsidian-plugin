import { Plugin } from "obsidian";


export interface WhisperSettings {
	// API settings
	apiProviderSetting: string;
	openAIAPIKey: string;
	openAIFormatAPIKey: string;
	openAIFormatAPIUri: string;
	geminiAPIKey: string;
	anthropicAPIKey: string;

	// Transcription settings
	transcriptionMode: string;
	transcriptionLLMProvider: string;
	transcriptionSTTProvider: string;
	transcriptionLLMModel: string;
	transcriptionSTTModel: string;
	transcriptionLLMTemperature: number;
	transcriptionSTTLanguage: string;
	transcriptionLLMPrompt: string;
	transcriptionSTTPrompt: string;

	// File saving settings
	audioSavingToggle: boolean;
	audioSavingPath: string;
	createNewFileAfterRecording: boolean;
	createNewFileAfterRecordingPath: string;

	// Post processing settings
	postProcessingToggle: boolean;
	postProcessingProvider: string;
	postProcessingModel: string;
	postProcessingTemperature: number;
	postProcessingPrompt: string;

	// Title generation settings
	titleGenerationToggle: boolean;
	titleGenerationProvider: string;
	titleGenerationModel: string;
	titleGenerationTemperature: number;
	titleGenerationPrompt: string;
	keepOriginalTranscription: boolean;

	// Silence removal settings
	silenceRemovalToggle: boolean;
	silenceThreshold: number;  // in dB
	silenceDuration: number;   // in seconds
	silenceRemoveAll: boolean; // whether to remove all silence periods

	// Disc
	debugMode: boolean;
}

export const OPENAI_API_URI = "https://api.openai.com/v1"
export const GEMINI_API_URI = "https://generativelanguage.googleapis.com/v1beta"
export const ANTHROPIC_API_URI = "https://api.anthropic.com/v1"

export const DEFAULT_SETTINGS: WhisperSettings = {
	// API
	apiProviderSetting: "openai",
	openAIAPIKey: "",
	openAIFormatAPIKey: "",
	openAIFormatAPIUri: "",
	geminiAPIKey: "",
	anthropicAPIKey: "",

	// Transcription
	transcriptionMode: "llm-mode",
	transcriptionLLMProvider: "gemini",
	transcriptionSTTProvider: "openai",
	transcriptionLLMModel: "gemini-2.0-flash",
	transcriptionSTTModel: "whisper-1",
	transcriptionLLMTemperature: 0.5,
	transcriptionSTTLanguage: "en",
	transcriptionLLMPrompt: "You are a perfect transcription program that is able to convert speech to a readable, grammatically correct transcriptions without changing the content or changing the specific formulations. It is important that you leave formulations as they are, and make no attempts to formalize or professionalize them. Always return as much of the content as possible. If there are repetions of content, choose the best (often last) one and make the sentence work with that. Just return the transcriptions, do not comment on it, or introduce it. Always transcribe in the language of the speech.",
	transcriptionSTTPrompt: "",

	// File Saving
	audioSavingToggle: true,
	audioSavingPath: "",
	debugMode: false,
	createNewFileAfterRecording: true,
	createNewFileAfterRecordingPath: "",

	// Post Processing
	postProcessingToggle: false,
	postProcessingProvider: "gemini",
	postProcessingModel: "gemini-2.0-flash",
	postProcessingTemperature: 0.5,
	postProcessingPrompt: "You are a perfect transcription program that is able to take faulty dictations and put them into a readable, grammatically correct form without changing their content or changing their specific formulations. It is important that you leave formulations as they are, and make no attempts to formalize or professionalize them. Always return as much of the content as possible. If there are repetions of content, choose the best (often last) one and make the sentence work with that. Just return the dictation, do not comment on it, or introduce it. Always transcribe in the language of the dictation. Here comes the dictation: \n\n",

	// Title Generation
	titleGenerationToggle: false,
	titleGenerationProvider: "gemini",
	titleGenerationModel: "gemini-2.0-flash-lite",
	titleGenerationTemperature: 0.7,
	titleGenerationPrompt: "You are an intelligent bureaucratic assistant. You are tasked with generating a short (1-5 words), precise title for the TEXT below. Reply only with the title, nothing else. Generate the title in the main language of the TEXT. TEXT:",
	keepOriginalTranscription: false,

	// Slience Removal
	silenceRemovalToggle: false,
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
