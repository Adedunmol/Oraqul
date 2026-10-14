import { shareTokenFor } from './queries';
import { markRead, removeProject, setShare } from './store';

// Stand-ins for the mutation helpers in lib/api (spec §7). Each is a synchronous change to the
// demo state; the real ones post to the API and then `router.refresh()`.

export type { FirstMessage } from './flows';
export {
  answerQuestion,
  askScenario,
  quickAsk,
  resultsFlow as addResults,
  sendText as sendMessage,
  setActor,
  startFromMessage as createProject,
  startThread as createThread,
  whatIf,
} from './flows';

/** `DELETE /projects/:id` */
export const deleteProject = removeProject;

/** `PATCH /shares/:token` */
export function setShareEnabled(outputId: string, enabled: boolean): void {
  setShare(outputId, shareTokenFor(outputId), enabled);
}

export { markRead as markThreadRead };
