import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { advancePlaybackTimeSec, PLAYBACK_SPEEDS } = await server.ssrLoadModule('/src/utils/playbackClock.ts');
  const { evaluateMasterTimeline } = await server.ssrLoadModule('/src/utils/timelineEngine.ts');
  const { getDiseaseById } = await server.ssrLoadModule('/src/data/diseases/index.ts');
  const { HeartDiagram } = await server.ssrLoadModule('/src/components/HeartDiagram.tsx');
  for (const speed of PLAYBACK_SPEEDS) {
    assert.equal(advancePlaybackTimeSec(0, 1, 2.4, speed), speed);
    assert.ok(Math.abs(advancePlaybackTimeSec(2.3, 1, 2.4, speed) - ((2.3 + speed) % 2.4)) < 1e-12);
  }
  const afterChange = advancePlaybackTimeSec(advancePlaybackTimeSec(0.3, 0.1, 2.4, 0.25), 0.1, 2.4, 1);
  assert.ok(Math.abs(afterChange - 0.425) < 1e-12, 'changing speed must not reset the phase');
  const junctional = getDiseaseById('junctional_rhythm');
  let atrialSamples = 0;
  const lowerRAFronts = [];
  for (let t = 0; t < junctional.scenarioDurationSec; t += 0.005) {
    const snapshot = evaluateMasterTimeline(junctional, t);
    assert.equal(snapshot.saNodeFiring, false);
    assert.equal(snapshot.sourceRegion, 'av_junction');
    if (snapshot.subSegments.ra_inferior.phase !== 'front_active') continue;
    atrialSamples++;
    const svg = renderToStaticMarkup(React.createElement(HeartDiagram, { snapshot, showElectricVector: false }));
    assert.ok(svg.includes('洞結節：停止（発火なし）'));
    assert.ok(svg.includes('M 184 170 L 151 159'), 'RA conduction must start at the AV junction');
    assert.ok(svg.includes('M 184 170 L 211 148'), 'LA conduction must start at the AV junction');
    assert.ok(!svg.includes('d="M 108 85'), 'no atrial emission from the sinus node');
    assert.equal((svg.match(/data-segment=/g) ?? []).length, 14);
    const front = svg.match(/data-front="ra_inferior" transform="translate\(([^,]+), ([^)]+)\)"/);
    assert.ok(front, 'retrograde lower RA front must render');
    lowerRAFronts.push({ p: snapshot.subSegments.ra_inferior.frontProgress, y: Number(front[2]) });
  }
  assert.ok(atrialSamples > 0);
  lowerRAFronts.sort((a, b) => a.p - b.p);
  assert.ok(lowerRAFronts.at(-1).y < lowerRAFronts[0].y, 'retrograde atrial front must rise toward the upper atrium');
  const normal = evaluateMasterTimeline(getDiseaseById('normal'), 0.06);
  const normalSvg = renderToStaticMarkup(React.createElement(HeartDiagram, { snapshot: normal, showElectricVector: false }));
  assert.ok(normalSvg.includes('d="M 108 85'), 'normal antegrade conduction must retain its sinus origin');
  console.log(`PASS: 3 playback speeds, loop wrapping, phase continuity; ${atrialSamples} junctional atrial samples with AV-origin rendering, ascending front and 14 segments; normal sinus origin retained.`);
} finally {
  await server.close();
}
