import {AudioPlaybackManager} from './audioPlaybackManager'
// Deterministic dev check: stale mock audio must never begin after a new generation.
export async function testStaleMockAudio(){const manager=new AudioPlaybackManager();manager.startGeneration('test',1);const late=manager.mockLateResponse('test',1,20);manager.interrupt();manager.startGeneration('test',2);return (await late)===false&&manager.metrics.finalGeneration===2}
