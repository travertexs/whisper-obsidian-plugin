import Whisper from "main";
import { ButtonComponent, Modal, Setting } from "obsidian";
import { RecordingStatus } from "./StatusBar";
import { generateTimestampedFileName } from "./utils";

export class Controls extends Modal {
	private plugin: Whisper;
	private startButton: ButtonComponent;
	private pauseButton: ButtonComponent;
	private stopButton: ButtonComponent;
	private timerDisplay: HTMLElement;

	constructor(plugin: Whisper) {
		super(plugin.app);
		this.plugin = plugin;
		this.containerEl.addClass("recording-controls");

		// Set onUpdate callback for the timer
		this.plugin.timer.setOnUpdate(() => {
			this.updateTimerDisplay();
		});
	}

	async startRecording() {
		console.log("start");
		this.plugin.statusBar.updateStatus(RecordingStatus.Recording);
		await this.plugin.recorder.startRecording();
		this.plugin.timer.start();
		this.resetGUI();
	}

	async pauseRecording() {
		console.log("pausing recording...");
		await this.plugin.recorder.pauseRecording();
		this.plugin.timer.pause();
		this.resetGUI();
	}

	async stopRecording() {
		const currentState = this.plugin.recorder.getRecordingState();
		// Prevent stopping if already inactive
		if (currentState === "inactive" || !currentState) {
			console.log("Recording is already inactive. Ignoring stop command.");
			return;
		}

		console.log("stopping recording...");
		this.plugin.statusBar.updateStatus(RecordingStatus.Processing);
		const blob = await this.plugin.recorder.stopRecording();
		this.plugin.timer.reset();
		this.resetGUI();

		const extension = this.plugin.recorder.getMimeType()?.split("/")[1];
		const fileName = generateTimestampedFileName(extension);
		
		await this.plugin.audioHandler.sendAudioData(blob, fileName);
		this.plugin.statusBar.updateStatus(RecordingStatus.Idle);
		this.updateTimerDisplay();
	}

	updateTimerDisplay() {
		this.timerDisplay.textContent = this.plugin.timer.getFormattedTime();
	}

	resetGUI() {
		const recorderState = this.plugin.recorder.getRecordingState();
		// Treat undefined state (after stopping) as inactive for UI disabling
		const isEffectivelyInactive = recorderState === "inactive" || typeof recorderState === 'undefined';

		this.startButton.setDisabled(
			recorderState === "recording" || recorderState === "paused"
		);
		this.pauseButton.setDisabled(
			isEffectivelyInactive
		);
		this.stopButton.setDisabled(
			isEffectivelyInactive
		);

		this.pauseButton.setButtonText(
			recorderState === "paused" ? " Resume" : " Pause"
		);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add elapsed time display
		this.timerDisplay = contentEl.createEl("div", { cls: "timer" });
		this.updateTimerDisplay();

		// Add button group
		const buttonGroupEl = contentEl.createEl("div", {
			cls: "button-group",
		});

		// Add record button
		this.startButton = new ButtonComponent(buttonGroupEl);
		this.startButton
			.setIcon("microphone")
			.setButtonText(" Record")
			.onClick(this.startRecording.bind(this))
			.buttonEl.addClass("button-component");

		// Add pause button
		this.pauseButton = new ButtonComponent(buttonGroupEl);
		this.pauseButton
			.setIcon("pause")
			.setButtonText(" Pause")
			.onClick(this.pauseRecording.bind(this))
			.setDisabled(true)
			.buttonEl.addClass("button-component");

		// Add stop button
		this.stopButton = new ButtonComponent(buttonGroupEl);
		this.stopButton
			.setIcon("square")
			.setButtonText(" Stop")
			.onClick(this.stopRecording.bind(this))
			.setDisabled(true)
			.buttonEl.addClass("button-component");

		// Add language selector below the controls
		const languageSetting = new Setting(contentEl)
			.setName("Language")
			.setDesc("Select or enter the language for transcription");

		// Create a container for the dropdown and input
		const languageContainer = languageSetting.controlEl.createDiv();
		languageContainer.style.display = "flex";
		languageContainer.style.gap = "10px";
		languageContainer.style.alignItems = "center";

		// Add dropdown for common languages
		const dropdown = languageContainer.createEl("select");
		const commonLanguages = [
			{ value: "", label: "Choose language..." },
			{ value: "en", label: "English" },
			{ value: "es", label: "Spanish" },
			{ value: "fr", label: "French" },
			{ value: "de", label: "German" },
			{ value: "zh", label: "Chinese" },
		];

		commonLanguages.forEach(lang => {
			const option = dropdown.createEl("option");
			option.value = lang.value;
			option.text = lang.label;
		});

		// Set initial value
		dropdown.value = commonLanguages.find(lang => 
			lang.value === this.plugin.settings.transcriptionSTTLanguage
		)?.value || "";

		// Add text input for custom language
		const customInput = languageContainer.createEl("input", {
			type: "text",
			placeholder: "Custom language code",
		});
		customInput.style.display = dropdown.value === "" ? "block" : "none";
		customInput.value = commonLanguages.some(lang => 
			lang.value === this.plugin.settings.transcriptionSTTLanguage
		) ? "" : this.plugin.settings.transcriptionSTTLanguage;

		// Hide the language dropdown and custom input if in LLM transcription mode
		if (this.plugin.settings.transcriptionMode === 'llm-mode') {
			languageSetting.settingEl.style.display = "none";
		}

		// Handle dropdown changes
		dropdown.addEventListener("change", async () => {
			const selectedValue = dropdown.value;
			customInput.style.display = selectedValue === "" ? "block" : "none";
			
			if (selectedValue !== "") {
				this.plugin.settings.transcriptionSTTLanguage = selectedValue;
				await this.plugin.settingsManager.saveSettings(this.plugin.settings);
			}
		});

		// Handle custom input changes
		customInput.addEventListener("change", async () => {
			if (customInput.value) {
				this.plugin.settings.transcriptionSTTLanguage = customInput.value;
				await this.plugin.settingsManager.saveSettings(this.plugin.settings);
			}
		});

		this.resetGUI();
	}
}
