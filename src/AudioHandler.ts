import axios from "axios";
import Whisper from "main";
import { Notice, MarkdownView } from "obsidian";
import { getBaseFileName } from "./utils";
import { OPENAI_API_URI, GEMINI_API_URI, ANTHROPIC_API_URI } from "./SettingsManager";

export class AudioHandler {
	private plugin: Whisper;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
	}

	async sendAudioData(blob: Blob, fileName: string): Promise<void> {
		// If silence removal is enabled, the blob should be WAV format
		// Update the filename extension accordingly
		if (this.plugin.settings.silenceRemovalToggle) {
			fileName = fileName.replace(/\.[^/.]+$/, '.wav');
			console.log("Using WAV filename:", fileName);
		}

		// Generate a timestamped filename (already provided in fileName)
		const timestampedFileName = fileName;
		const baseFileName = getBaseFileName(timestampedFileName);

		// Set file paths
		let audioFilePath = `${
			this.plugin.settings.audioSavingPath
				? `${this.plugin.settings.audioSavingPath}/`
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
		if (this.plugin.settings.audioSavingToggle) {
			try {
				const arrayBuffer = await blob.arrayBuffer();
				await this.plugin.app.vault.adapter.writeBinary(
					audioFilePath,
					new Uint8Array(arrayBuffer)
				);
				new Notice("Audio saved successfully.");
			} catch (err: any) {
				console.error("Error saving audio file:", err);
				new Notice("Error saving audio file: " + err.message);
			}
		}

		const isProviderOpenAI = this.plugin.settings.postProcessingProvider === "openai";
		const isProviderGemini = this.plugin.settings.postProcessingProvider === "gemini";
		const isProviderAnthropic = this.plugin.settings.postProcessingProvider === "anthropic";

		let transcriptionResponse;
		let originalText = "";
		let finalText: string;
		try {
			if (this.plugin.settings.debugMode) {
				new Notice("Parsing audio data:" + timestampedFileName);
			}

			if (this.plugin.settings.transcriptionMode == "llm-mode")
			{
				if (isProviderOpenAI) {
					transcriptionResponse = await axios.post(
						OPENAI_API_URI + "/chat/completions",
						{
							model: this.plugin.settings.transcriptionLLMModel,
							modalities: ["text", "audio"],
							messages: [
								{
									role: "system",
									content: [{
										type: "text",
										text: this.plugin.settings.transcriptionLLMPrompt,
									}],
								},
								{
									role: "user",
									content: [{
										type: "input_audio",
										input_audio: {
											data: blob,
											format: 
												this.plugin.settings.silenceRemovalToggle ?
												"wav" :
												"mp3",
										},
									}],
								},
							],
							temperature: this.plugin.settings.transcriptionLLMTemperature,
						},
						{
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${this.plugin.settings.openAIFormatAPIKey}`,
							},
						}
					);

					originalText = transcriptionResponse.data.choices[0].message.content.trim();
				} else if (isProviderGemini) {
					transcriptionResponse = await axios.post(
						GEMINI_API_URI + "/models/" +
						this.plugin.settings.transcriptionLLMModel +
						"\:generateContent?key=" +
						this.plugin.settings.geminiAPIKey, {
							system_instruction: {
								parts: [
									{
										text: this.plugin.settings.transcriptionLLMPrompt,
									},
								],
							},
							contents: [
								{
									role: "user",
									parts: [
										{
											inlineData: {
												mimeType: this.plugin.settings.silenceRemovalToggle ?
													"audio/mp3" :
													"audio/wav",
												data: blob,
											},
										},
									],
								},
							],
							generationConfig: {
								temperature: this.plugin.settings.transcriptionLLMTemperature,
							},
						},
						{
							headers: {
								"Content-Type": "application/json",
							},
						},
					);

					originalText = transcriptionResponse.data.candidates[0].content.parts[0].text;
				}
			} else {
				// Create FormData object
				const formData = new FormData();
				formData.append("file", blob, timestampedFileName);
				formData.append("model", this.plugin.settings.transcriptionSTTModel);
				formData.append("language", this.plugin.settings.transcriptionSTTLanguage);
				if (this.plugin.settings.transcriptionSTTPrompt) {
					formData.append("prompt", this.plugin.settings.transcriptionSTTPrompt);
				}

				// Call Whisper API for transcription
				transcriptionResponse = await axios.post(
					this.plugin.settings.openAIFormatAPIUri + "/audio/transcriptions",
					formData,
					{
						headers: {
							"Content-Type": "multipart/form-data",
							Authorization: `Bearer ${this.plugin.settings.openAIFormatAPIKey}`,
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

				originalText = transcriptionResponse.data.text;
			}
			finalText = originalText;

			if (
				this.plugin.settings.postProcessingToggle &&
				this.plugin.settings.postProcessingModel &&
				this.plugin.settings.postProcessingPrompt &&
				this.plugin.settings.transcriptionMode === "stt-mode"
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Post-processing transcription...");
				}

				try {
					let postProcessResponse;

					if (isProviderOpenAI) {
						postProcessResponse = await axios.post(
							OPENAI_API_URI + "/chat/completions",
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
								temperature: this.plugin.settings.postProcessingTemperature,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAIAPIKey}`,
								},
							}
						);
						finalText = postProcessResponse.data.choices[0].message.content.trim();
					} else if (isProviderGemini) {
						if (!this.plugin.settings.geminiAPIKey) {
							throw new Error("Gemini API key is required for Gemini models");
						}

						postProcessResponse = await axios.post(
							GEMINI_API_URI + "/models/" +
							this.plugin.settings.postProcessingModel +
							"\:generateContent?key=" +
							this.plugin.settings.geminiAPIKey, {
								system_instruction: {
									parts: [
										{
											text: this.plugin.settings.postProcessingPrompt,
										},
									],
								},
								contents: [
									{
										role: "user",
										parts: [
											{
												text: finalText
											},
										],
									},
								],
								generationConfig: {
									temperature: this.plugin.settings.postProcessingTemperature,
								},
							},
							{
								headers: {
									"Content-Type": "application/json",
								},
							},
						);
						finalText = postProcessResponse.data.candidates[0].content.parts[0].text;
					} else if (isProviderAnthropic) {
						if (!this.plugin.settings.anthropicAPIKey) {
							throw new Error("Anthropic API key is required for Claude models");
						}

						postProcessResponse = await axios.post(
							ANTHROPIC_API_URI + "/messages",
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
									"x-api-key": this.plugin.settings.anthropicAPIKey,
									"anthropic-version": "2023-06-01",
									"anthropic-dangerous-direct-browser-access": "true"
								}
							}
						);
						finalText = postProcessResponse.data.content[0].text;
					} else {
						postProcessResponse = await axios.post(
							this.plugin.settings.openAIFormatAPIUri + "/chat/completions",
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
								temperature: this.plugin.settings.postProcessingTemperature,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAIFormatAPIKey}`,
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
				this.plugin.settings.titleGenerationToggle &&
				this.plugin.settings.titleGenerationModel &&
				this.plugin.settings.titleGenerationPrompt
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Generating title...");
				}
				try {
					let titleResponse;

					if (isProviderOpenAI) {
						titleResponse = await axios.post(
							OPENAI_API_URI +"/chat/completions",
							{
								model: this.plugin.settings.postProcessingModel || "gpt-4.1-mini",
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
								temperature: this.plugin.settings.titleGenerationTemperature,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAIAPIKey}`,
								},
							}
						);
						finalTitle = titleResponse.data.choices[0].message.content.trim();
					} else if (isProviderGemini) {
						if (!this.plugin.settings.geminiAPIKey) {
							throw new Error("Gemini API key is required for Gemini models");
						}

						titleResponse = await axios.post(
							GEMINI_API_URI + "/models/" +
							this.plugin.settings.postProcessingModel +
							"\:generateContent?key=" +
							this.plugin.settings.geminiAPIKey, {
								system_instruction: {
									parts: [
										{
											text: this.plugin.settings.titleGenerationPrompt,
										},
									],
								},
								contents: [
									{
										role: "user",
										parts: [
											{
												text: finalText,
											},
										],
									},
								],
								generationConfig: {
									temperature: this.plugin.settings.titleGenerationTemperature,
								},
							},
							{
								headers: {
									"Content-Type": "application/json",
								},
							},
						);
						finalTitle = titleResponse.data.candidates[0].content.parts[0].text;
					} else if (isProviderAnthropic) {
						if (!this.plugin.settings.anthropicAPIKey) {
							throw new Error("Anthropic API key is required for Claude models");
						}

						titleResponse = await axios.post(
							ANTHROPIC_API_URI + "/messages",
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
									"x-api-key": this.plugin.settings.anthropicAPIKey,
									"anthropic-version": "2023-06-01",
									"anthropic-dangerous-direct-browser-access": "true"
								}
							}
						);
						finalTitle = titleResponse.data.content[0].text;
					} else {
						titleResponse = await axios.post(
							this.plugin.settings.openAIFormatAPIUri +"/chat/completions",
							{
								model: this.plugin.settings.postProcessingModel,
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
								temperature: this.plugin.settings.titleGenerationTemperature,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openAIFormatAPIKey}`,
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
							this.plugin.settings.audioSavingPath
								? `${this.plugin.settings.audioSavingPath}/`
								: ""
						}${nowFileName}`;

						noteFilePath = `${
							this.plugin.settings.createNewFileAfterRecordingPath
								? `${this.plugin.settings.createNewFileAfterRecordingPath}/`
								: ""
						}${nowBaseFileName}.md`;

						// If audio was saved, rename it
						if (this.plugin.settings.audioSavingToggle) {
							const oldAudioPath = `${
								this.plugin.settings.audioSavingPath
									? `${this.plugin.settings.audioSavingPath}/`
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

			let noteContent = 
				this.plugin.settings.saveAudioFile ?
				`![[${audioFilePath}]]\n${finalText}` :
				`${finalText}`;

			// Add original transcription if enabled
			if (this.plugin.settings.keepOriginalTranscription && finalText !== originalText) {
				noteContent += "\n\n## Original Dictation\n" + originalText;
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