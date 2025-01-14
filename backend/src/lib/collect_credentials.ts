// https://github.com/DoctorMcKay/node-steam-user/blob/master/examples/lib/collect_credentials.js
import { createInterface } from 'readline';

/**
 * @returns {Promise<{accountName: string, password: string}>}
 */
export default async function collectCredentials() {
	let accountName = await promptAsync('Account Name: ');
	let password = await promptAsync('Password: ', true);
	return {accountName, password};
};

/**
 *
 * @param {string} question
 * @param {boolean} [sensitiveInput=false]
 * @return Promise<string>
 */
function promptAsync(question: string, sensitiveInput = false) {
	return new Promise((resolve) => {
		let rl = createInterface({
			input: process.stdin,
			output: sensitiveInput ? undefined : process.stdout,
			terminal: true
		});

		if (sensitiveInput) {
			// We have to write the question manually if we didn't give readline an output stream
			process.stdout.write(`${question.trim()} [masked] `);
		}

		rl.question(question, (result) => {
			if (sensitiveInput) {
				// We have to manually print a newline
				process.stdout.write('\n');
			}

			rl.close();
			resolve(result);
		});
	});
}