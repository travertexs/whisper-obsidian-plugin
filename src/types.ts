import { Plugin } from "obsidian";
import { WhisperSettings } from "./SettingsManager";

export interface Whisper extends Plugin {
    settings: WhisperSettings;
} 