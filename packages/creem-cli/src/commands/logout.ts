import { Command } from 'commander';
import { logout } from '../lib/auth';
import { isAuthenticated } from '../lib/config';
import * as output from '../utils/output';

export function createLogoutCommand(): Command {
  const command = new Command('logout')
    .description('Log out and clear stored credentials')
    .action(() => {
      if (!isAuthenticated()) {
        output.info('Not currently logged in.');
        return;
      }

      const result = logout();

      if (result.success) {
        output.success('Successfully logged out.');
        output.dim('Your API key has been removed from local storage.');
      } else {
        output.error(result.message);
        process.exit(1);
      }
    });

  return command;
}
