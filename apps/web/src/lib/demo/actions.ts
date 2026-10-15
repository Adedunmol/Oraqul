import { shareTokenFor } from './queries';
import { markRead, setShare } from './store';

// Stand-ins for the mutation helpers in lib/api (spec §7) that outputs still need. Each is a
// synchronous change to the demo state; the real ones post to the API and then `router.refresh()`.
// Projects, chats and pins have moved to the API (lib/api/projects.ts).

export { answerQuestion, runNextStep, sendText as sendMessage, setActor } from './flows';

/** `PATCH /shares/:token` */
export function setShareEnabled(outputId: string, enabled: boolean): void {
  setShare(outputId, shareTokenFor(outputId), enabled);
}

export { markRead as markThreadRead };
