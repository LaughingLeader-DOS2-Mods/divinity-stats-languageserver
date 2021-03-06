import {
	createConnection,
	Connection,
	DidChangeConfigurationNotification,
	DidChangeConfigurationParams,
	InitializeParams,
	InitializeResult,
	ProposedFeatures,
	ServerCapabilities,
	TextDocuments,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	CompletionItem,
	CompletionItemKind
} from "vscode-languageserver/node";

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import DivinityStatsSettings from "./DivinityStatsSettings";
import Completion from "./Completion";

const defaultSettings: DivinityStatsSettings = new DivinityStatsSettings();
let globalSettings: DivinityStatsSettings = new DivinityStatsSettings();

export default class Server {
	connection: Connection;
	documents: TextDocuments<TextDocument>;
	documentSettings: Map<string, Thenable<DivinityStatsSettings>> = new Map();

	hasConfigurationCapability: boolean = false;
	hasWorkspaceFolderCapability: boolean = false;
	hasDiagnosticRelatedInformationCapability: boolean = false;

	completion: Completion = new Completion(this);

	constructor() {
		// Create a connection for the server. The connection uses Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		const connection = createConnection(ProposedFeatures.all);
		
		connection.onInitialize(this.handleInitialize);
		connection.onInitialized(this.handleInitialized);
		connection.onDidChangeConfiguration(this.handleDidChangeConfiguration);

		connection.onExit(() => {
			
		});

		this.connection = connection;

		const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
		this.documents = documents;

		documents.listen(connection);
		connection.listen();
	}

	getDocumentSettings(resource: string): Thenable<DivinityStatsSettings> { 
		const { connection, documentSettings, hasConfigurationCapability } = this;
		if (!hasConfigurationCapability) {
			return Promise.resolve(globalSettings);
		}

		let result = documentSettings.get(resource);
		if (!result) {
			result = connection.workspace.getConfiguration({
				scopeUri: resource,
				section: "divinityStats"
			});
			documentSettings.set(resource, result);
		}

		return result;
	}

	async getGlobalSettings() : Promise<DivinityStatsSettings>{
		const { connection, hasConfigurationCapability } = this;
		let settings:DivinityStatsSettings = defaultSettings;
		try
		{
			if(hasConfigurationCapability) {
				await connection.workspace.getConfiguration({ 
					section: "divinityStats"
				}).then(s => {
					settings = s;
				});
			} else {
				connection.console.log(`Returning global settings: ${hasConfigurationCapability}`);
				settings = globalSettings;
			}
		}
		catch(e) {
			connection.console.log(`Error getting settings: ${e}`);
		}
		return settings;
	}

	handleDidChangeConfiguration = (change: DidChangeConfigurationParams) => {
		const { documents, documentSettings, hasConfigurationCapability } = this;

		if (hasConfigurationCapability) {
			// Reset all cached document settings
			documentSettings.clear();
		} else {
			globalSettings = <DivinityStatsSettings>(
			(change.settings.divinityStats || defaultSettings)
			);
		}

		// Revalidate all open text documents
		// documents.all().forEach(document => this.project.analyze(document));
	}

	handleInitialize = (params: InitializeParams): InitializeResult => {
		const { capabilities } = params;
		const { textDocument, workspace } = capabilities;

		// Does the client support the `workspace/configuration` request?
		// If not, we will fall back using global settings
		this.hasConfigurationCapability = !!(
			workspace && !!workspace.configuration
		);

		this.hasWorkspaceFolderCapability = !!(
			workspace && !!workspace.workspaceFolders
		);

		this.hasDiagnosticRelatedInformationCapability = !!(
			textDocument &&
			textDocument.publishDiagnostics &&
			textDocument.publishDiagnostics.relatedInformation
		);

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: {
					resolveProvider: true,
					triggerCharacters: ['"']
				}
			} as ServerCapabilities
		};
	}

	handleInitialized = () => {
		const { connection, hasConfigurationCapability } = this;

		//connection.sendNotification(readyEvent);

		if (hasConfigurationCapability) {
			// Register for all configuration changes.
			connection.client.register(
				DidChangeConfigurationNotification.type,
				undefined
			);
		}

		const completion = new Completion(this);
		this.completion = completion;
	}
}