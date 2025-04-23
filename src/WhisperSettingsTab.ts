import Whisper from "main";
import { App, PluginSettingTab, Setting, TFolder } from "obsidian";
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
		
		// Add new API Keys header
		this.containerEl.createEl("h2", { text: "API Keys" });
		this.createApiKeySettings();

		this.containerEl.createEl("h2", { text: "Transcription Settings" });
		this.createApiUrlSetting();
		this.createModelSetting();
		this.createPromptSetting();
		this.createLanguageSetting();
		this.createSaveAudioFileToggleSetting();
		this.createSaveAudioFilePathSetting();
		this.createNewFileToggleSetting();
		this.createNewFilePathSetting();
		this.createDebugModeToggleSetting();

		this.containerEl.createEl("h2", { text: "Post-processing Settings" });
		this.createPostProcessingSettings();

		this.createSilenceRemovalSettings();
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

	private createTextSetting(
		name: string,
		desc: string,
		placeholder: string,
		value: string,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange(async (value) => await onChange(value))
			);
	}

	private createApiKeySettings(): void {
		// Whisper API Key
		this.createTextSetting(
			"Whisper API Key",
			"Enter your API key for Whisper transcription (This can be the same as your OpenAI API key, but could also be a key to the groq-API or Microsoft Azure.)",
			"sk-...xxxx",
			this.plugin.settings.whisperApiKey,
			async (value) => {
				this.plugin.settings.whisperApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);

		// OpenAI API Key
		this.createTextSetting(
			"OpenAI API Key",
			"Enter your OpenAI API key to use GPT models",
			"sk-...xxxx",
			this.plugin.settings.openAiApiKey,
			async (value) => {
				this.plugin.settings.openAiApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);

		// Gemini API Key
		this.createTextSetting(
			"Gemini API Key",
			"Enter your Gemini API key for Gemini models",
			"Alza...",
			this.plugin.settings.geminiApiKey,
			async (value) => {
				this.plugin.settings.geminiApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);

		// Anthropic API Key
		this.createTextSetting(
			"Anthropic API Key",
			"Enter your Anthropic API key for Claude models",
			"sk-ant-...",
			this.plugin.settings.anthropicApiKey,
			async (value) => {
				this.plugin.settings.anthropicApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createApiUrlSetting(): void {
		this.createTextSetting(
			"API URL",
			"Specify the endpoint that will be used to make requests to",
			"https://api.your-custom-url.com",
			this.plugin.settings.apiUrl,
			async (value) => {
				this.plugin.settings.apiUrl = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createModelSetting(): void {
		this.createTextSetting(
			"Model",
			"Specify the machine learning model to use for transcribing audio to text (whisper-1 for OpenAI, whisper-large-v3 for Groq)",
			"whisper-1",
			this.plugin.settings.model,
			async (value) => {
				this.plugin.settings.model = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createPromptSetting(): void {
		this.createTextSetting(
			"Prompt",
			"Optional: Add words with their correct spellings to help with transcription. Make sure it matches the chosen language.",
			"Example: ZyntriQix, Digique Plus, CynapseFive",
			this.plugin.settings.prompt,
			async (value) => {
				this.plugin.settings.prompt = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createLanguageSetting(): void {
		this.createTextSetting(
			"Language",
			"Specify the language of the message being whispered (e.g. en for English). This can be left blank for auto-detection with OpenAI, but has to be set when using Groq.",
			"en",
			this.plugin.settings.language,
			async (value) => {
				this.plugin.settings.language = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createSaveAudioFileToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Save recording")
			.setDesc(
				"Turn on to save the audio file after sending it to the Whisper API"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.saveAudioFile)
					.onChange(async (value) => {
						this.plugin.settings.saveAudioFile = value;
						if (!value) {
							this.plugin.settings.saveAudioFilePath = "";
						}
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
						this.saveAudioFileInput.setDisabled(!value);
					})
			);
	}

	private createSaveAudioFilePathSetting(): void {
		this.saveAudioFileInput = new Setting(this.containerEl)
			.setName("Recordings folder")
			.setDesc(
				"Specify the path in the vault where to save the audio files"
			)
			.addText((text) =>
				text
					.setPlaceholder("Example: folder/audio")
					.setValue(this.plugin.settings.saveAudioFilePath)
					.onChange(async (value) => {
						this.plugin.settings.saveAudioFilePath = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					})
			)
			.setDisabled(!this.plugin.settings.saveAudioFile);
	}

	private createNewFileToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Save transcription")
			.setDesc(
				"Turn on to create a new file for each recording, or leave off to add transcriptions at your cursor"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.createNewFileAfterRecording)
					.onChange(async (value) => {
						this.plugin.settings.createNewFileAfterRecording =
							value;
						if (!value) {
							this.plugin.settings.createNewFileAfterRecordingPath =
								"";
						}
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
						this.createNewFileInput.setDisabled(!value);
					});
			});
	}

	private createNewFilePathSetting(): void {
		this.createNewFileInput = new Setting(this.containerEl)
			.setName("Transcriptions folder")
			.setDesc(
				"Specify the path in the vault where to save the transcription files"
			)
			.addText((text) => {
				text.setPlaceholder("Example: folder/note")
					.setValue(
						this.plugin.settings.createNewFileAfterRecordingPath
					)
					.onChange(async (value) => {
						this.plugin.settings.createNewFileAfterRecordingPath =
							value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
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
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}
	


	private createPostProcessingSettings(): void {
		// Toggle to enable/disable post-processing
		new Setting(this.containerEl)
			.setName("Use Post-processing")
			.setDesc("Turn on to post-process the transcribed text using GPT.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.usePostProcessing)
				.onChange(async (value) => {
					this.plugin.settings.usePostProcessing = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
					// You may want to enable/disable other controls based on this value
				}));

		// Post-processing prompt
		new Setting(this.containerEl)
			.setName("Post-processing Prompt")
			.setDesc("Enter the prompt that will be sent to the GPT model to polish the transcription.")
			.addTextArea(textArea => textArea
				.setPlaceholder("Enter your prompt here...")
				.setValue(this.plugin.settings.postProcessingPrompt)
				.onChange(async (value) => {
					this.plugin.settings.postProcessingPrompt = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));


		// Update model dropdown
		const models = [
			"gpt-4.1",
			"gpt-4.1-mini",
			"gpt-4.1-nano",
			"gpt-4o",
			"gpt-4o-mini",
			"gemini-2.0-flash",
			"gemini-2.0-flash-lite",
			"claude-3-7-sonnet-latest",
			"claude-3-5-sonnet-latest",
			"claude-3-5-haiku-latest",
			"claude-3-opus-latest"
		];
		new Setting(this.containerEl)
			.setName("Post-processing Model")
			.setDesc("Select which AI model to use for post-processing.")
			.addDropdown(dropdown => {
				models.forEach(model => dropdown.addOption(model, model));
				dropdown.setValue(this.plugin.settings.postProcessingModel);
				dropdown.onChange(async (value) => {
					this.plugin.settings.postProcessingModel = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				});
			});

		// Auto generate title
		new Setting(this.containerEl)
			.setName("Auto-generate Title")
			.setDesc("Turn on to automatically generate a title for the transcribed text.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoGenerateTitle)
				.onChange(async (value) => {
					this.plugin.settings.autoGenerateTitle = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));

		// Title-generation prompt
		new Setting(this.containerEl)
			.setName("Title-generation Prompt")
			.setDesc("The prompt used to generate a title from the transcribed text.")
			.addTextArea(textArea => textArea
				.setPlaceholder("Enter your title-generation prompt...")
				.setValue(this.plugin.settings.titleGenerationPrompt)
				.onChange(async (value) => {
					this.plugin.settings.titleGenerationPrompt = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));

		// Add new setting for keeping original transcription
		new Setting(this.containerEl)
			.setName("Keep Original Transcription")
			.setDesc("If enabled, adds the original Whisper transcription below the post-processed text.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepOriginalTranscription)
				.onChange(async (value) => {
					this.plugin.settings.keepOriginalTranscription = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));
	}

	private createSilenceRemovalSettings(): void {
		this.containerEl.createEl("h2", { text: "Silence Removal Settings" });

		// Note below the header
		this.containerEl.createEl("p", {
			text: "Note: If Remove Silence is enabled, the final audio will be saved as a WAV file."
		});

		// Toggle to enable/disable silence removal
		new Setting(this.containerEl)
			.setName("Remove Silence")
			.setDesc("Remove silence from audio before processing (final file will be WAV).")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSilenceRemoval)
				.onChange(async (value) => {
					this.plugin.settings.useSilenceRemoval = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));

		// Silence threshold
		new Setting(this.containerEl)
			.setName("Silence Threshold")
			.setDesc("Sound level (in dB) below which audio is considered silence. Lower values are more aggressive (-50 is default)")
			.addSlider(slider => slider
				.setLimits(-70, -5, 1)
				.setValue(this.plugin.settings.silenceThreshold)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.silenceThreshold = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));

		// Silence duration
		new Setting(this.containerEl)
			.setName("Minimum Silence Duration")
			.setDesc("Minimum duration (in seconds) of silence to remove")
			.addSlider(slider => slider
				.setLimits(0.05, 10.0, 0.1)
				.setValue(this.plugin.settings.silenceDuration)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.silenceDuration = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));

		// Remove all silence periods
		new Setting(this.containerEl)
			.setName("Remove All Silence")
			.setDesc("When enabled, removes all silent periods throughout the audio. When disabled, only removes leading and trailing silence.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.silenceRemoveAll)
				.onChange(async (value) => {
					this.plugin.settings.silenceRemoveAll = value;
					await this.settingsManager.saveSettings(this.plugin.settings);
				}));
	}
}
