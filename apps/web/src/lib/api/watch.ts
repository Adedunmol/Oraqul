import {
  type ActualRow,
  type ActualsPreview,
  actualsPreviewResultSchema,
  calendarFeedTokenSchema,
  emptyResponseSchema,
  type PaceState,
  paceStateSchema,
  type UpdatePaceBody,
  type UpdateWatch,
  type WatchState,
  watchStateSchema,
} from '@oraqul/schema';
import { clientFile, clientRequest } from './client';

export function updateWatch(outputId: string, body: UpdateWatch): Promise<WatchState> {
  return clientRequest(`/outputs/${outputId}/watch`, { method: 'PUT', body }, watchStateSchema);
}

export function setWatchMuted(outputId: string, muted: boolean): Promise<WatchState> {
  return clientRequest(
    `/outputs/${outputId}/watch/mute`,
    { method: 'PUT', body: { muted } },
    watchStateSchema,
  );
}

export function markWatchRead(outputId: string): Promise<void> {
  return clientRequest(`/outputs/${outputId}/watch/read`, { method: 'POST' }, emptyResponseSchema);
}

export function approveWatchEvent(outputId: string, eventId: string): Promise<WatchState> {
  return clientRequest(
    `/outputs/${outputId}/watch/events/${eventId}/approve`,
    { method: 'POST' },
    watchStateSchema,
  );
}

export function dismissWatchEvent(outputId: string, eventId: string): Promise<WatchState> {
  return clientRequest(
    `/outputs/${outputId}/watch/events/${eventId}/dismiss`,
    { method: 'POST' },
    watchStateSchema,
  );
}

/** Reads pasted lines or a CSV into rows and a column mapping. Nothing is saved. */
export function previewActuals(
  outputId: string,
  text: string,
  mapping: ActualsPreview['mapping'],
): Promise<ActualsPreview> {
  return clientRequest(
    `/outputs/${outputId}/actuals/preview`,
    { method: 'POST', body: { text, mapping } },
    actualsPreviewResultSchema,
  );
}

export function saveActuals(outputId: string, rows: ActualRow[]): Promise<PaceState> {
  return clientRequest(
    `/outputs/${outputId}/actuals`,
    { method: 'PUT', body: { rows } },
    paceStateSchema,
  );
}

export function deleteActual(outputId: string, actualId: string): Promise<PaceState> {
  return clientRequest(
    `/outputs/${outputId}/actuals/${actualId}`,
    { method: 'DELETE' },
    paceStateSchema,
  );
}

export function updatePace(outputId: string, body: UpdatePaceBody): Promise<PaceState> {
  return clientRequest(`/outputs/${outputId}/pace`, { method: 'PUT', body }, paceStateSchema);
}

/** The plan's dates as a calendar file. */
export function downloadCalendar(outputId: string): Promise<Blob> {
  return clientFile(`/outputs/${outputId}/calendar.ics`);
}

/** The feed's token is in this answer only: the API keeps its hash. */
export async function createCalendarFeed(projectId: string): Promise<string> {
  const { token } = await clientRequest(
    `/projects/${projectId}/calendar-feed`,
    { method: 'POST' },
    calendarFeedTokenSchema,
  );
  return token;
}

export function revokeCalendarFeed(projectId: string): Promise<void> {
  return clientRequest(
    `/projects/${projectId}/calendar-feed`,
    { method: 'DELETE' },
    emptyResponseSchema,
  );
}
