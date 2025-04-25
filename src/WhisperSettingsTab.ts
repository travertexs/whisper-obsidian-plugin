import Whisper from "main";
import { App, PluginSettingTab, Setting, TFolder, TextComponent } from "obsidian";
import { SettingsManager } from "./SettingsManager";

export class WhisperSettingsTab extends PluginSettingTab {
	private plugin: Whisper;
	private settingsManager: SettingsManager;
	private createNewFileInput: Setting;
	private saveAudioFileInput: Setting;

	constructor(app: App, plugin: Whisper) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = plugin.settingsManager;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		this.containerEl.createEl("h1", { text: "Whisper Settings" });

		// Add new API Keys header
		this.containerEl.createEl("h2", { text: "API Settings" });
		this.createAPISettings();

		this.containerEl.createEl("h2", { text: "Transcription Settings" });
		this.createTranscriptionSettings();

		this.containerEl.createEl("h2", { text: "File Saving Settings" });
		this.createFileSavingSettings();

		if (this.plugin.settings.transcriptionMode === "stt-mode") {
			this.containerEl.createEl("h2", { text: "Post-processing Settings" });
		}
		this.createPostProcessingSettings();

		this.containerEl.createEl("h2", { text: "Title Generation Settings" });
		this.createTitleGenerationSettings();

		this.containerEl.createEl("h2", { text: "Slience Removal Settings" });
		this.createSilenceRemovalSettings();

		this.containerEl.createEl("h2", { text: "Developer Settings" });
		this.createDebugModeToggleSetting();
	}

	private getUniqueFolders(): TFolder[] {
		const files = this.app.vault.getMarkdownFiles();
		const folderSet = new Set<TFolder>();

		for (const file of files) {
			const parentFolder = file.parent;
			if (parentFolder && parentFolder instanceof TFolder) {
				folderSet.add(parentFolder);
			}
		}

		return Array.from(folderSet);
	}

	private createAPISettings(): void {
		const providers = {
			"openai": "OpenAI",
			"openaiFormat": "OpenAI Format",
			"gemini": "Gemini",
			"anthropic": "Anthropic",
		};
		new Setting(this.containerEl)
		.setName("Choose platform settings")
		.setDesc("Select which platform settings to display.")
		.addDropdown(dropdown => {
			for (const [key, value] of Object.entries(providers)) {
				dropdown.addOption(key, value);
			}
			dropdown.setValue(this.plugin.settings.apiProviderSetting);
			dropdown.onChange(async (value) => {
				this.plugin.settings.apiProviderSetting = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
				this.display();
			});
		});

		// OpenAI API Key
		if (this.plugin.settings.apiProviderSetting === "openai") {
			new Setting(this.containerEl)
			.setName("OpenAI API Key")
			.setDesc("Enter your OpenAI API key to use models from OpenAI.")
			.addText((text) => {
				text.setPlaceholder("sk-...xxxx");
				text.setValue(this.plugin.settings.openAIAPIKey);
				text.onChange(async (value) => {
					this.plugin.settings.openAIAPIKey = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}

		// OpenAI Format API Key
		else if (this.plugin.settings.apiProviderSetting === "openaiFormat") {
			new Setting(this.containerEl)
			.setName("OpenAI Format API Key")
			.setDesc("Enter your Third-party API key to use custom models")
			.addText((text) => {
				text.setValue(this.plugin.settings.openAIFormatAPIKey);
				text.onChange(async (value) => {
					this.plugin.settings.openAIFormatAPIKey = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			new Setting(this.containerEl)
			.setName("OpenAI Format API URI")
			.setDesc("Specify the endpoint that will be used to make requests to.")
			.addText((text) => {
				text.setPlaceholder("https://api.your-custom-url.com/v1");
				text.setValue(this.plugin.settings.openAIFormatAPIUri);
				text.onChange(async (value) => {
					this.plugin.settings.openAIFormatAPIUri = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}

		// Gemini API Key
		else if (this.plugin.settings.apiProviderSetting === "gemini") {
			new Setting(this.containerEl)
			.setName("Gemini API Key")
			.setDesc("Enter your Gemini API key for Gemini models")
			.addText((text) => {
				text.setPlaceholder("Alza...");
				text.setValue(this.plugin.settings.geminiAPIKey);
				text.onChange(async (value) => {
					this.plugin.settings.geminiAPIKey = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}

		// Anthropic API Key
		else if (this.plugin.settings.apiProviderSetting === "anthropic") {
			new Setting(this.containerEl)
			.setName("Anthropic API Key")
			.setDesc("Enter your Anthropic API key for Claude models")
			.addText((text) => {
				text.setPlaceholder("sk-ant-...");
				text.setValue(this.plugin.settings.anthropicAPIKey);
				text.onChange(async (value) => {
					this.plugin.settings.anthropicAPIKey = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}
	}

	private createTranscriptionSettings(): void {
		// Transcription Mode Settings
		const modes = {
			"llm-mode": "LLM Transcribing Mode",
			"stt-mode": "Speech-to-text Mode",
		};
		new Setting(this.containerEl)
		.setName("Transcription Mode")
		.setDesc("Select which transcription mode to use for transcribing.")
		.addDropdown(dropdown => {
			for (const [key, value] of Object.entries(modes)) {
				dropdown.addOption(key, value);
			}
			dropdown.setValue(this.plugin.settings.transcriptionMode);
			dropdown.onChange(async (value) => {
				this.plugin.settings.transcriptionMode = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
				this.display();
			});
		});


		
		if (this.plugin.settings.transcriptionMode === "llm-mode") {
			// Transcription Provider Settings
			const providers = {
				"openai": "OpenAI",
				"openaiFormat": "OpenAI Format",
				"gemini": "Gemini",
			};
			new Setting(this.containerEl)
			.setName("Choose provider for LLM")
			.setDesc("Select which provider to use.")
			.addDropdown(dropdown => {
				for (const [key, value] of Object.entries(providers)) {
					dropdown.addOption(key, value);
				}
				dropdown.setValue(this.plugin.settings.transcriptionLLMProvider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.transcriptionLLMProvider = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Model Settings
			new Setting(this.containerEl)
			.setName("LLM")
			.setDesc("Specify the LLM to use for transcribing audio to text (gpt-4o-mini-audio for OpenAI, gemini-2.0-flash for Gemini, etc)")
			.addText((text) => {
				text.setValue(this.plugin.settings.transcriptionLLMModel);
				text.onChange(async (value) => {
					this.plugin.settings.transcriptionLLMModel = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Temperature Settings
			new Setting(this.containerEl)
			.setName("Temperature for transcribing")
			.setDesc("Specify the temperature of the LLM. A value between 0 and 2. Higher values (closer to 2) means more creative outputs.")
			.addSlider(slider => {
				slider.setLimits(0.0, 2.0, 0.1);
				slider.setValue(this.plugin.settings.transcriptionLLMTemperature);
				slider.setDynamicTooltip();
				slider.onChange(async (value) => {
					this.plugin.settings.transcriptionLLMTemperature = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Prompt Settings
			new Setting(this.containerEl)
			.setName("LLM Prompt")
			.setDesc("Enter the prompt that will be sent to the LLM to transcribe the audio.")
			.addTextArea(textArea => {
				textArea.setPlaceholder("Enter your prompt here...");
				textArea.setValue(this.plugin.settings.transcriptionLLMPrompt);
				textArea.onChange(async (value) => {
					this.plugin.settings.transcriptionLLMPrompt = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		} else {
			// Transcription Provider Settings
			const providers = {
				"openai": "OpenAI",
				"openaiFormat": "OpenAI Format",
			};
			new Setting(this.containerEl)
			.setName("Choose provider for speech-to-text model")
			.setDesc("Select which provider to use.")
			.addDropdown(dropdown => {
				for (const [key, value] of Object.entries(providers)) {
					dropdown.addOption(key, value);
				}
				dropdown.setValue(this.plugin.settings.transcriptionSTTProvider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.transcriptionSTTProvider = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Model Settings
			new Setting(this.containerEl)
			.setName("Speech-to-text Model")
			.setDesc("Specify the speech-to-text model to use for transcribing audio to text (whisper-1 for OpenAI, whisper-large-v3 for Groq, etc)")
			.addText((text) => {
				text.setValue(this.plugin.settings.transcriptionSTTModel);
				text.onChange(async (value) => {
					this.plugin.settings.transcriptionSTTModel = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Language Settings
			new Setting(this.containerEl)
			.setName("Language")
			.setDesc("Specify the language of the speech (e.g. en for English). This can be left blank for auto-detection with some models, but some has to be set.")
			.addText(text => {
				text.setPlaceholder("en");
				text.setValue(this.plugin.settings.transcriptionSTTLanguage);
				text.onChange(async (value) => {
					this.plugin.settings.transcriptionSTTLanguage = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Transcription Prompt Settings
			new Setting(this.containerEl)
			.setName("Speech-to-text Prompt")
			.setDesc("Optional: Add words with their correct spellings to help with transcription. Make sure it matches the chosen language.")
			.addTextArea(textArea => {
				textArea.setPlaceholder("Example: ZyntriQix, Digique Plus, CynapseFive");
				textArea.setValue(this.plugin.settings.transcriptionSTTPrompt);
				textArea.onChange(async (value) => {
					this.plugin.settings.transcriptionSTTPrompt = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}
	}

	private createFileSavingSettings(): void {
		// File Saving Toggle
		new Setting(this.containerEl)
		.setName("Save recording")
		.setDesc(
			"Turn on to save the audio file after sending it to the Whisper API"
		)
		.addToggle((toggle) => {
			toggle.setValue(this.plugin.settings.audioSavingToggle);
			toggle.onChange(async (value) => {
				this.plugin.settings.audioSavingToggle = value;
				if (!value) {
					this.plugin.settings.audioSavingPath = "";
				}
				await this.settingsManager.saveSettings(
					this.plugin.settings
				);
				this.saveAudioFileInput.setDisabled(!value);
			});
		});

		// File Saving Path
		this.saveAudioFileInput = new Setting(this.containerEl)
		.setName("Recordings folder")
		.setDesc(
			"Specify the path in the vault where to save the audio files"
		)
		.addText((text) => {
			text.setPlaceholder("Example: folder/audio");
			text.setValue(this.plugin.settings.audioSavingPath);
			text.onChange(async (value) => {
				this.plugin.settings.audioSavingPath = value;
				await this.settingsManager.saveSettings(
					this.plugin.settings
				);
			});
		})
		.setDisabled(!this.plugin.settings.audioSavingToggle);

		// Transcription Saving Toggle
		new Setting(this.containerEl)
		.setName("Save transcription")
		.setDesc(
			"Turn on to create a new file for each recording, or leave off to add transcriptions at your cursor"
		)
		.addToggle((toggle) => {
			toggle.setValue(this.plugin.settings.createNewFileAfterRecording);
			toggle.onChange(async (value) => {
				this.plugin.settings.createNewFileAfterRecording = value;
				if (!value) {
					this.plugin.settings.createNewFileAfterRecordingPath = "";
				}
				await this.settingsManager.saveSettings(
					this.plugin.settings
				);
				this.createNewFileInput.setDisabled(!value);
			});
		});

		// Transcription File Path
		this.createNewFileInput = new Setting(this.containerEl)
		.setName("Transcriptions folder")
		.setDesc(
			"Specify the path in the vault where to save the transcription files"
		)
		.addText((text) => {
			text.setPlaceholder("Example: folder/note");
			text.setValue(
				this.plugin.settings.createNewFileAfterRecordingPath
			);
			text.onChange(async (value) => {
				this.plugin.settings.createNewFileAfterRecordingPath = value;
				await this.settingsManager.saveSettings(
					this.plugin.settings
				);
			});
		});
	}

	private createPostProcessingSettings(): void {
		if (this.plugin.settings.transcriptionMode === "stt-mode") {
			// Toggle to enable/disable post-processing
			new Setting(this.containerEl)
			.setName("Use Post-processing")
			.setDesc("Turn on to post-process the transcribed text using GPT.")
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.postProcessingToggle);
				toggle.onChange(async (value) => {
					this.plugin.settings.postProcessingToggle = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
					// You may want to enable/disable other controls based on this value
				});
			});

			const providers = {
				"openai": "OpenAI",
				"openaiFormat": "OpenAI Format",
				"gemini": "Gemini",
				"anthropic": "Anthropic",
			};
			new Setting(this.containerEl)
			.setName("Choose provider for LLM")
			.setDesc("Select which provider to use.")
			.addDropdown(dropdown => {
				for (const [key, value] of Object.entries(providers)) {
					dropdown.addOption(key, value);
				}
				dropdown.setValue(this.plugin.settings.postProcessingProvider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.postProcessingProvider = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
					this.display();
				});
			});

			// Post-processing model
			new Setting(this.containerEl)
			.setName("Post-processing Model")
			.setDesc("Specify the AI model to use for post-processing (gpt-4o-mini-audio for OpenAI, gemini-2.0-flash for Gemini, etc).")
			.addText((text) => {
				text.setValue(this.plugin.settings.postProcessingModel);
				text.onChange(async (value) => {
					this.plugin.settings.postProcessingModel = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Post-Processing Temperature
			new Setting(this.containerEl)
			.setName("Temperature for post-processing")
			.setDesc("Specify the temperature of the LLM. A value between 0 and 2. Higher values (closer to 2) means more creative outputs.")
			.addSlider(slider => {
				slider.setLimits(0.0, 2.0, 0.1);
				slider.setValue(this.plugin.settings.postProcessingTemperature);
				slider.setDynamicTooltip();
				slider.onChange(async (value) => {
					this.plugin.settings.postProcessingTemperature = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Post-processing prompt
			new Setting(this.containerEl)
			.setName("Post-processing Prompt")
			.setDesc("Enter the prompt that will be sent to the GPT model to polish the transcription.")
			.addTextArea(textArea => {
				textArea.setPlaceholder("Enter your prompt here...");
				textArea.setValue(this.plugin.settings.postProcessingPrompt);
				textArea.onChange(async (value) => {
					this.plugin.settings.postProcessingPrompt = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

			// Add new setting for keeping original transcription
			new Setting(this.containerEl)
			.setName("Keep Original Transcription")
			.setDesc("If enabled, adds the original transcription below the post-processed text.")
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.keepOriginalTranscription);
				toggle.onChange(async (value) => {
					this.plugin.settings.keepOriginalTranscription = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});
		}
	}

	private createTitleGenerationSettings(): void {
		// Auto generate title
		new Setting(this.containerEl)
		.setName("Auto-generate Title")
		.setDesc("Turn on to automatically generate a title for the transcribed text.")
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.titleGenerationToggle);
			toggle.onChange(async (value) => {
				this.plugin.settings.titleGenerationToggle = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});

		const providers = {
			"openai": "OpenAI",
			"openaiFormat": "OpenAI Format",
			"gemini": "Gemini",
			"anthropic": "Anthropic",
		};
		new Setting(this.containerEl)
		.setName("Choose provider for LLM")
		.setDesc("Select which provider to use.")
		.addDropdown(dropdown => {
			for (const [key, value] of Object.entries(providers)) {
				dropdown.addOption(key, value);
			}
			dropdown.setValue(this.plugin.settings.titleGenerationProvider);
			dropdown.onChange(async (value) => {
				this.plugin.settings.titleGenerationProvider = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
				this.display();
			});
		});

			// Title generation model
			new Setting(this.containerEl)
			.setName("Title Generation Model")
			.setDesc("Specify the AI model to use for post-processing (gpt-4o-mini-audio for OpenAI, gemini-2.0-flash for Gemini, etc).")
			.addText((text) => {
				text.setValue(this.plugin.settings.titleGenerationModel);
				text.onChange(async (value) => {
					this.plugin.settings.titleGenerationModel = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

		// Title Generation Temperature
		new Setting(this.containerEl)
		.setName("Temperature for title generating")
		.setDesc("Specify the temperature of the LLM. A value between 0 and 2. Higher values (closer to 2) means more creative outputs.")
		.addSlider(slider => {
			slider.setLimits(0.0, 2.0, 0.1);
			slider.setValue(this.plugin.settings.titleGenerationTemperature);
			slider.setDynamicTooltip();
			slider.onChange(async (value) => {
				this.plugin.settings.titleGenerationTemperature = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});

		// Title-generation prompt
		new Setting(this.containerEl)
		.setName("Title-generation Prompt")
		.setDesc("The prompt used to generate a title from the transcribed text.")
		.addTextArea(textArea => {
			textArea.setPlaceholder("Enter your title-generation prompt...");
			textArea.setValue(this.plugin.settings.titleGenerationPrompt);
			textArea.onChange(async (value) => {
				this.plugin.settings.titleGenerationPrompt = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});
	}

	private createSilenceRemovalSettings(): void {
		// Note below the header
		this.containerEl.createEl("p", {
			text: "Note: If Remove Silence is enabled, the final audio will be saved as a WAV file."
		});

		// Toggle to enable/disable silence removal
		new Setting(this.containerEl)
		.setName("Remove Silence")
		.setDesc("Remove silence from audio before processing (final file will be WAV).")
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.silenceRemovalToggle);
			toggle.onChange(async (value) => {
				this.plugin.settings.silenceRemovalToggle = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});

		// Silence threshold
		new Setting(this.containerEl)
		.setName("Silence Threshold")
		.setDesc("Sound level (in dB) below which audio is considered silence. Lower values are more aggressive (-50 is default)")
		.addSlider(slider => {
			slider.setLimits(-70, -5, 1);
			slider.setValue(this.plugin.settings.silenceThreshold);
			slider.setDynamicTooltip();
			slider.onChange(async (value) => {
				this.plugin.settings.silenceThreshold = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});

		// Silence duration
		new Setting(this.containerEl)
		.setName("Minimum Silence Duration")
		.setDesc("Minimum duration (in seconds) of silence to remove")
		.addSlider(slider => {
			slider.setLimits(0.05, 10.0, 0.1);
			slider.setValue(this.plugin.settings.silenceDuration);
			slider.setDynamicTooltip();
			slider.onChange(async (value) => {
				this.plugin.settings.silenceDuration = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});

		// Remove all silence periods
		new Setting(this.containerEl)
		.setName("Remove All Silence")
		.setDesc("When enabled, removes all silent periods throughout the audio. When disabled, only removes leading and trailing silence.")
		.addToggle(toggle => {
			toggle.setValue(this.plugin.settings.silenceRemoveAll);
			toggle.onChange(async (value) => {
				this.plugin.settings.silenceRemoveAll = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			});
		});
	}

	private createDebugModeToggleSetting(): void {
		new Setting(this.containerEl)
		.setName("Debug Mode")
		.setDesc(
			"Turn on to increase the plugin's verbosity for troubleshooting."
		)
		.addToggle((toggle) => {
			toggle.setValue(this.plugin.settings.debugMode);
			toggle.onChange(async (value) => {
				this.plugin.settings.debugMode = value;
				await this.settingsManager.saveSettings(
					this.plugin.settings
				);
			});
		});
	}
}
