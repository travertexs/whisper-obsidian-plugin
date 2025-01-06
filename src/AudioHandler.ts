import axios from "axios";
import Whisper from "main";
import { Notice, MarkdownView } from "obsidian";
import { getBaseFileName } from "./utils";

export class AudioHandler {
	private plugin: Whisper;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
	}

	async sendAudioData(blob: Blob, fileName: string): Promise<void> {
		// If silence removal is enabled, the blob should be WAV format
		// Update the filename extension accordingly
		if (this.plugin.settings.useSilenceRemoval) {
			fileName = fileName.replace(/\.[^/.]+$/, '.wav');
			console.log("Using WAV filename:", fileName);
		}

		// Generate a timestamped filename (already provided in fileName)
		const timestampedFileName = fileName;
		const baseFileName = getBaseFileName(timestampedFileName);

		// Set file paths
		let audioFilePath = `${
			this.plugin.settings.saveAudioFilePath
				? `${this.plugin.settings.saveAudioFilePath}/`
				: ""
		}${timestampedFileName}`;

		let noteFilePath = `${
			this.plugin.settings.createNewFileAfterRecordingPath
				? `${this.plugin.settings.createNewFileAfterRecordingPath}/`
				: ""
		}${baseFileName}.md`;

		if (this.plugin.settings.debugMode) {
			console.log("Saving audio to:", audioFilePath);
			console.log("Audio format:", blob.type);
			console.log("Audio size:", blob.size);
		}

		// Save audio file if setting is enabled
		try {
			if (this.plugin.settings.saveAudioFile) {
				const arrayBuffer = await blob.arrayBuffer();
					await this.plugin.app.vault.adapter.writeBinary(
						audioFilePath,
						new Uint8Array(arrayBuffer)
					);
					new Notice("Audio saved successfully.");
			}
		} catch (err: any) {
			console.error("Error saving audio file:", err);
			new Notice("Error saving audio file: " + err.message);
		}

		let finalText: string;
		let originalText: string;
		try {
			if (this.plugin.settings.debugMode) {
				new Notice("Parsing audio data:" + timestampedFileName);
			}

			// Create FormData object
			const formData = new FormData();
			formData.append("file", blob, timestampedFileName);
			formData.append("model", this.plugin.settings.model);
			formData.append("language", this.plugin.settings.language);
			if (this.plugin.settings.prompt) {
				formData.append("prompt", this.plugin.settings.prompt);
			}

			// Call Whisper API for transcription
			const whisperResponse = await axios.post(
				this.plugin.settings.apiUrl,
				formData,
				{
					headers: {
						"Content-Type": "multipart/form-data",
						Authorization: `Bearer ${this.plugin.settings.whisperApiKey}`,
					},
				}
			).catch(error => {
				// Log detailed API error response
				if (error.response) {
					console.error("API Error Response:", {
						status: error.response.status,
						statusText: error.response.statusText,
						data: error.response.data
					});
					throw new Error(`API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					console.error("No response received:", error.request);
					throw new Error("No response received from API");
				} else {
					console.error("Error setting up request:", error.message);
					throw error;
				}
			});

			originalText = whisperResponse.data.text;
			finalText = originalText;

			// Check for post-processing
			if (
				this.plugin.settings.usePostProcessing &&
				this.plugin.settings.postProcessingModel
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Post-processing transcription...");
				}

				try {
					let postProcessResponse;
					const isAnthropicModel = this.plugin.settings.postProcessingModel.startsWith('claude');

					if (isAnthropicModel) {
						if (!this.plugin.settings.anthropicApiKey) {
							throw new Error("Anthropic API key is required for Claude models");
						}

						postProcessResponse = await axios.post(
							"https://api.anthropic.com/v1/messages",
							{
								model: this.plugin.settings.postProcessingModel,
								max_tokens: 8190,
								messages: [
									{
										role: "user",
										content: this.plugin.settings.postProcessingPrompt + "\n\n" + finalText
									}
								]
							},
							{
								headers: {
									"Content-Type": "application/json",
									"x-api-key": this.plugin.settings.anthropicApiKey,
									"anthropic-version": "2023-06-01",
									"anthropic-dangerous-direct-browser-access": "true"
								}
							}
						);
						finalText = postProcessResponse.data.content[0].text;
					} else {
						postProcessResponse = await axios.post(
							"https://api.openai.com/v1/chat/completions",
							{
								model: this.plugin.settings.postProcessingModel,
								messages: [
									{
										role: "system",
										content: this.plugin.settings.postProcessingPrompt,
									},
									{
										role: "user",
										content: finalText,
									},
								],
								temperature: 0.7,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAiApiKey}`,
								},
							}
						);
						finalText = postProcessResponse.data.choices[0].message.content.trim();
					}

					if (this.plugin.settings.debugMode) {
						new Notice("Post-processing complete.");
					}
				} catch (postErr: any) {
					console.error("Error during post-processing:", postErr);
					new Notice(
						"Error during post-processing: " + postErr.message
					);
				}
			}

			// Title generation if enabled
			let finalTitle: string | null = null;
			if (
				this.plugin.settings.autoGenerateTitle &&
				this.plugin.settings.titleGenerationPrompt
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Generating title...");
				}
				try {
					let titleResponse;
					const isAnthropicModel = this.plugin.settings.postProcessingModel.startsWith('claude');

					if (isAnthropicModel) {
						if (!this.plugin.settings.anthropicApiKey) {
							throw new Error("Anthropic API key is required for Claude models");
						}

						titleResponse = await axios.post(
							"https://api.anthropic.com/v1/messages",
							{
								model: this.plugin.settings.postProcessingModel,
								max_tokens: 1000,
								messages: [
									{
										role: "user",
										content: this.plugin.settings.titleGenerationPrompt + "\n\n" + finalText
									}
								]
							},
							{
								headers: {
									"Content-Type": "application/json",
									"x-api-key": this.plugin.settings.anthropicApiKey,
									"anthropic-version": "2023-06-01",
									"anthropic-dangerous-direct-browser-access": "true"
								}
							}
						);
						finalTitle = titleResponse.data.content[0].text;
					} else {
						titleResponse = await axios.post(
							"https://api.openai.com/v1/chat/completions",
							{
								model: this.plugin.settings.postProcessingModel || "gpt-4o",
								messages: [
									{
										role: "system",
										content: this.plugin.settings.titleGenerationPrompt,
									},
									{
										role: "user",
										content: finalText,
									},
								],
								temperature: 0.7,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAiApiKey}`,
								},
							}
						);
						finalTitle = titleResponse.data.choices[0].message.content.trim();
					}

					if (this.plugin.settings.debugMode) {
						new Notice(`Title generated: ${finalTitle}`);
					}

					if (finalTitle) {
						// Clean title to be filename-safe
						finalTitle = finalTitle
							.replace(/[/\\?%*:|"<>]/g, "-")
							.replace(/\n/g, " ")
							.trim();

						// Prepend the generated title to the filename
						const nowFileName = `${finalTitle} - ${timestampedFileName}`;
						const nowBaseFileName = getBaseFileName(nowFileName);

						audioFilePath = `${
							this.plugin.settings.saveAudioFilePath
								? `${this.plugin.settings.saveAudioFilePath}/`
								: ""
						}${nowFileName}`;

						noteFilePath = `${
							this.plugin.settings.createNewFileAfterRecordingPath
								? `${this.plugin.settings.createNewFileAfterRecordingPath}/`
								: ""
						}${nowBaseFileName}.md`;

						// If audio was saved, rename it
						if (this.plugin.settings.saveAudioFile) {
							const oldAudioPath = `${
								this.plugin.settings.saveAudioFilePath
									? `${this.plugin.settings.saveAudioFilePath}/`
									: ""
							}${timestampedFileName}`;
							await this.plugin.app.vault.adapter.rename(
								oldAudioPath,
								audioFilePath
							);
						}
					}
				} catch (titleErr: any) {
					console.error("Error generating title:", titleErr);
					new Notice("Error generating title: " + titleErr.message);
					finalTitle = null;
				}
			}

			// Decide whether to create a new file or insert into the current one
			const activeView =
				this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			const shouldCreateNewFile =
				this.plugin.settings.createNewFileAfterRecording || !activeView;

			let noteContent = "";
			if (
				this.plugin.settings.autoGenerateTitle &&
				finalTitle &&
				finalTitle.trim() !== ""
			) {
				noteContent = `![[${audioFilePath}]]\n${finalText}`;
				
				// Add original transcription if enabled
				if (this.plugin.settings.keepOriginalTranscription && finalText !== originalText) {
					noteContent += "\n\n## Original Dictation\n" + originalText;
				}
			} else {
				noteContent = `![[${audioFilePath}]]\n${finalText}`;
				
				// Add original transcription if enabled
				if (this.plugin.settings.keepOriginalTranscription && finalText !== originalText) {
					noteContent += "\n\n## Original Dictation\n" + originalText;
				}
			}

			if (shouldCreateNewFile) {
				await this.plugin.app.vault.create(noteFilePath, noteContent);
				await this.plugin.app.workspace.openLinkText(
					noteFilePath,
					"",
					true
				);
			} else {
				// Insert transcription at cursor
				const editor =
					this.plugin.app.workspace.getActiveViewOfType(
						MarkdownView
					)?.editor;
				if (editor) {
					const cursorPosition = editor.getCursor();
					editor.replaceRange(noteContent, cursorPosition);

					// Move the cursor to end of inserted text
					const noteLines = noteContent.split("\n");
					const newPosition = {
						line: cursorPosition.line + noteLines.length - 1,
						ch: noteLines[noteLines.length - 1].length,
					};
					editor.setCursor(newPosition);
				}
			}

			new Notice("Audio parsed successfully.");
		} catch (err: any) {
			console.error("Error parsing audio:", err);
			new Notice("Error parsing audio: " + err.message);
		}
	}
}