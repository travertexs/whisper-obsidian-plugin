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
		// Generate a timestamped filename (already provided in fileName)
		const timestampedFileName = fileName;

		// Get the base file name without extension
		const baseFileName = getBaseFileName(timestampedFileName);

		// Default file paths before title generation
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
			new Notice(`Sending audio data size: ${blob.size / 1000} KB`);
		}

		if (!this.plugin.settings.apiKey) {
			new Notice(
				"API key is missing. Please add your API key in the settings."
			);
			return;
		}

		const formData = new FormData();
		formData.append("file", blob, timestampedFileName);
		formData.append("model", this.plugin.settings.model);
		formData.append("language", this.plugin.settings.language);
		if (this.plugin.settings.prompt) {
			formData.append("prompt", this.plugin.settings.prompt);
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
		try {
			if (this.plugin.settings.debugMode) {
				new Notice("Parsing audio data:" + timestampedFileName);
			}

			// Call Whisper API for transcription
			const whisperResponse = await axios.post(
				this.plugin.settings.apiUrl,
				formData,
				{
					headers: {
						"Content-Type": "multipart/form-data",
						Authorization: `Bearer ${this.plugin.settings.apiKey}`,
					},
				}
			);

			finalText = whisperResponse.data.text;

			// Check for post-processing
			if (
				this.plugin.settings.usePostProcessing &&
				this.plugin.settings.postProcessingModel
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Post-processing transcription with GPT...");
				}

				try {
					const postProcessResponse = await axios.post(
						"https://api.openai.com/v1/chat/completions",
						{
							model: this.plugin.settings.postProcessingModel,
							messages: [
								{
									role: "system",
									content:
										this.plugin.settings.postProcessingPrompt,
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
								Authorization: `Bearer ${this.plugin.settings.apiKey}`,
							},
						}
					);

					finalText = postProcessResponse.data.choices[0].message.content.trim();
					if (this.plugin.settings.debugMode) {
						new Notice("Post-processing complete.");
					}
				} catch (postErr: any) {
					console.error("Error during post-processing:", postErr);
					new Notice(
						"Error during post-processing: " + postErr.message
					);
					// If post-processing fails, use original finalText from whisper
				}
			}

			// Title generation if enabled
			let finalTitle: string | null = null;
			if (
				this.plugin.settings.autoGenerateTitle &&
				this.plugin.settings.titleGenerationPrompt
			) {
				if (this.plugin.settings.debugMode) {
					new Notice("Generating title with GPT...");
				}
				try {
					const titleResponse = await axios.post(
						"https://api.openai.com/v1/chat/completions",
						{
							model:
								this.plugin.settings.postProcessingModel ||
								"gpt-4o",
							messages: [
								{
									role: "system",
									content:
										this.plugin.settings.titleGenerationPrompt,
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
								Authorization: `Bearer ${this.plugin.settings.apiKey}`,
							},
						}
					);

					finalTitle = titleResponse.data.choices[0].message.content.trim();

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
				noteContent = `![[${audioFilePath}]]\n${finalText}`; // Lets not prepend final title for now # ${finalTitle}\n\n
			} else {
				noteContent = `![[${audioFilePath}]]\n${finalText}`;
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