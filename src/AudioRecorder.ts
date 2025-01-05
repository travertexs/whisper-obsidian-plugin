import { Notice } from "obsidian";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import type { Whisper } from "./types";

export interface AudioRecorder {
	startRecording(): Promise<void>;
	pauseRecording(): Promise<void>;
	stopRecording(): Promise<Blob>;
}

function getSupportedMimeType(): string | undefined {
	const mimeTypes = ["audio/mp3", "audio/mp4", "audio/webm", "audio/ogg"];

	for (const mimeType of mimeTypes) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			return mimeType;
		}
	}

	return undefined;
}

export class NativeAudioRecorder implements AudioRecorder {
	private chunks: BlobPart[] = [];
	private recorder: MediaRecorder | null = null;
	private mimeType: string | undefined;
	private ffmpeg: any;
	private ffmpegLoaded: boolean = false;
	private plugin: Whisper;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.ffmpeg = createFFmpeg({ log: false });
	}

	private async loadFFmpeg() {
		if (!this.ffmpegLoaded) {
			await this.ffmpeg.load();
			this.ffmpegLoaded = true;
		}
	}

	private async removeSilence(inputBlob: Blob): Promise<Blob> {
		if (!this.plugin.settings.useSilenceRemoval) {
			return inputBlob;
		}

		try {
			await this.loadFFmpeg();
			
			const inputBuffer = await inputBlob.arrayBuffer();
			this.ffmpeg.FS('writeFile', 'input.mp3', new Uint8Array(inputBuffer));

			const silenceFilter = `silenceremove=` +
				`stop_periods=${this.plugin.settings.silenceRemoveAll ? -1 : 1}:` +
				`stop_duration=${this.plugin.settings.silenceDuration}:` +
				`stop_threshold=${this.plugin.settings.silenceThreshold}dB`;

			await this.ffmpeg.run(
				'-i', 'input.mp3',
				'-af', silenceFilter,
				'-acodec', 'libmp3lame',
				'output.mp3'
			);

			const data = this.ffmpeg.FS('readFile', 'output.mp3');
			
			this.ffmpeg.FS('unlink', 'input.mp3');
			this.ffmpeg.FS('unlink', 'output.mp3');

			return new Blob([data.buffer], { type: 'audio/mp3' });
		} catch (error) {
			console.error('Error processing audio:', error);
			new Notice('Error processing audio: ' + error);
			return inputBlob;
		}
	}

	getRecordingState(): "inactive" | "recording" | "paused" | undefined {
		return this.recorder?.state;
	}

	getMimeType(): string | undefined {
		return this.mimeType;
	}

	async startRecording(): Promise<void> {
		if (!this.recorder) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				this.mimeType = getSupportedMimeType();

				if (!this.mimeType) {
					throw new Error("No supported mimeType found");
				}

				const options = { mimeType: this.mimeType };
				const recorder = new MediaRecorder(stream, options);

				recorder.addEventListener("dataavailable", (e: BlobEvent) => {
					console.log("dataavailable", e.data.size);
					this.chunks.push(e.data);
				});

				this.recorder = recorder;
			} catch (err) {
				new Notice("Error initializing recorder: " + err);
				console.error("Error initializing recorder:", err);
				return;
			}
		}

		this.recorder.start(100);
	}

	async pauseRecording(): Promise<void> {
		if (!this.recorder) {
			return;
		}

		if (this.recorder.state === "recording") {
			this.recorder.pause();
		} else if (this.recorder.state === "paused") {
			this.recorder.resume();
		}
	}

	async stopRecording(): Promise<Blob> {
		return new Promise((resolve) => {
			if (!this.recorder || this.recorder.state === "inactive") {
				const blob = new Blob(this.chunks, { type: this.mimeType });
				this.chunks.length = 0;
				this.removeSilence(blob).then(resolve);
			} else {
				this.recorder.addEventListener(
					"stop",
					async () => {
						const blob = new Blob(this.chunks, {
							type: this.mimeType,
						});
						this.chunks.length = 0;

						if (this.recorder) {
							this.recorder.stream
								.getTracks()
								.forEach((track) => track.stop());
							this.recorder = null;
						}

						const processedBlob = await this.removeSilence(blob);
						resolve(processedBlob);
					},
					{ once: true }
				);

				this.recorder.stop();
			}
		});
	}
}
