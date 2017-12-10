import WorkerFarm = require('parcel-bundler/src/WorkerFarm')

import {ConfigurationLoader} from '../../backend/config-loader'
import {reportDiagnostics} from '../../backend/reporter'
import {LanguageService} from '../../backend/service'
import {InjectedMessage} from '../../interfaces'

let serviceConfig: ConfigurationLoader<LanguageService>|null = null

/**
 * This function patch the WorkerFrame properties to interecpt
 * all messages sent from the workers.
 * When a file is updated a message will be sent to the master
 * and then dispatched to the type-checking worker.
 */
export function inject() {
	if(WorkerFarm.prototype.receive !== injectedReceive) {
		WorkerFarm.prototype.receive = injectedReceive
	}
}

const injectedReceive = ((receive: () => void) =>
	function(this: any, data: InjectedMessage) {
		if(data && data.__parcelTypeScript) {
			receiveMessage(data)
		}
		else {
			return receive.call(this, data)
		}
	}
)(WorkerFarm.prototype.receive)

export async function receiveMessage(data: InjectedMessage) {
	if(!data || !data.__parcelTypeScript) {
		throw new Error('Unknown Parcel TypeScript input message')
	}

	const {__parcelTypeScript: message} = data

	if(message.type === 'check-file') {
		const {file} = message

		// TODO: move this to a background thread
		if(serviceConfig === null) {
			serviceConfig = new ConfigurationLoader(file, config => new LanguageService(config))
		}

		const service = await serviceConfig.wait()
		const result = service.parse(file)

		reportDiagnostics(result)
	}
	else {
		throw new Error(`Unknown Parcel TypeScript message "${message}"`)
	}
}