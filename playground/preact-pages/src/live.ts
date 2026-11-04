import { defineLiveStream } from 'void/live';

export const live = defineLiveStream({
  id: 'preact-pages-playground',
  allowAnonymousControl: true,
});

export const LIVE_PLAYGROUND_TOPIC = 'playground:preact-pages';
