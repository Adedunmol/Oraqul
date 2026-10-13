import type { Role } from '@oraqul/schema';

export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const roleHelp: Record<Role, string> = {
  owner: 'Manages members and invites. Can do everything an editor can.',
  editor: 'Starts and continues plans, and edits projects.',
  viewer: 'Reads projects and outputs. Cannot change anything.',
};
