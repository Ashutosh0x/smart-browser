/**
 * Stage 2 Test: Response Inspection
 * Tests YouTube ad field stripping and manifest rewriting
 */

const { ResponseInspector } = require('./dist/response-inspector');
const { ManifestRewriter } = require('./dist/manifest-rewriter');

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         STAGE 2: RESPONSE INSPECTION TEST                  ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// =============================================================================
// Test 1: YouTube Player Response Ad Stripping
// =============================================================================

console.log('┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST 1: YouTube Player Response Ad Stripping              │');
console.log('└────────────────────────────────────────────────────────────┘');

const responseInspector = new ResponseInspector({ verbose: true });

// Simulated YouTube player API response with ads
const youtubePlayerResponse = {
    videoDetails: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        lengthSeconds: '212',
        channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
    },
    streamingData: {
        formats: [
            { itag: 18, url: 'https://r6---sn-n4v7snle.googlevideo.com/...' },
            { itag: 22, url: 'https://r6---sn-n4v7snle.googlevideo.com/...' },
        ],
        adaptiveFormats: [
            { itag: 137, mimeType: 'video/mp4', width: 1920, height: 1080 },
        ],
    },
    // AD FIELDS - SHOULD BE STRIPPED
    adPlacements: [
        {
            adPlacementRenderer: {
                config: { adPlacementConfig: { kind: 'AD_PLACEMENT_KIND_PREROLL' } },
                renderer: { instreamVideoAdRenderer: { clickthroughUrl: 'https://ads.google.com/...' } }
            }
        },
        {
            adPlacementRenderer: {
                config: { adPlacementConfig: { kind: 'AD_PLACEMENT_KIND_MIDROLL' } },
            }
        }
    ],
    playerAds: [
        {
            playerLegacyDesktopWatchAdsRenderer: {
                playerAdParams: { enabledEngageTypes: 'DISABLED' }
            }
        }
    ],
    adSlots: [
        { adSlotRenderer: { adSlotId: 'slot1', fulfillmentContent: {} } }
    ],
    adSignalsInfo: {
        params: [{ key: 'dt', value: '12345' }]
    },
    // LEGITIMATE FIELDS - SHOULD BE KEPT
    playbackTracking: {
        videostatsPlaybackUrl: { baseUrl: 'https://...' }
    },
    captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [] }
    }
};

const result = responseInspector.inspectResponse({
    url: 'https://www.youtube.com/youtubei/v1/player',
    body: JSON.stringify(youtubePlayerResponse),
    contentType: 'application/json',
});

console.log('');
console.log(`Modified: ${result.modified}`);
console.log(`Fields stripped: ${result.fieldsStripped.length}`);
console.log(`Bytes removed: ${result.bytesRemoved}`);
console.log('');
console.log('Stripped fields:');
result.fieldsStripped.forEach(field => console.log(`  ✗ ${field}`));
console.log('');

// Verify critical ad fields were stripped
const cleanedJson = JSON.parse(result.body);
const checks = [
    { field: 'adPlacements', present: 'adPlacements' in cleanedJson },
    { field: 'playerAds', present: 'playerAds' in cleanedJson },
    { field: 'adSlots', present: 'adSlots' in cleanedJson },
    { field: 'adSignalsInfo', present: 'adSignalsInfo' in cleanedJson },
    { field: 'videoDetails', present: 'videoDetails' in cleanedJson },
    { field: 'streamingData', present: 'streamingData' in cleanedJson },
];

console.log('Verification:');
let passed = 0;
for (const check of checks) {
    const shouldBePresent = !check.field.toLowerCase().includes('ad');
    const status = shouldBePresent === check.present ? '✓' : '✗';
    const expected = shouldBePresent ? 'KEPT' : 'STRIPPED';
    const actual = check.present ? 'PRESENT' : 'ABSENT';
    console.log(`  ${status} ${check.field}: ${actual} (expected: ${expected})`);
    if ((shouldBePresent === check.present)) passed++;
}
console.log('');

// =============================================================================
// Test 2: Manifest Rewriting
// =============================================================================

console.log('┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST 2: HLS Manifest Ad Segment Removal                   │');
console.log('└────────────────────────────────────────────────────────────┘');

const manifestRewriter = new ManifestRewriter({ verbose: true });

const hlsManifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment001.ts
#EXTINF:10.0,
segment002.ts
#EXT-X-CUE-OUT:DURATION=30
#EXTINF:10.0,
https://ads.example.com/adbreak/segment1.ts
#EXTINF:10.0,
https://ads.example.com/adbreak/segment2.ts
#EXTINF:10.0,
https://ads.example.com/adbreak/segment3.ts
#EXT-X-CUE-IN
#EXTINF:10.0,
segment003.ts
#EXTINF:10.0,
segment004.ts
#EXT-X-ENDLIST`;

const hlsResult = manifestRewriter.rewriteHLS(hlsManifest);
console.log('');
console.log(`Modified: ${hlsResult.modified}`);
console.log(`Segments removed: ${hlsResult.segmentsRemoved}`);
console.log('');

// =============================================================================
// Test 3: DASH Manifest Rewriting
// =============================================================================

console.log('┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST 3: DASH Manifest Ad Period Removal                   │');
console.log('└────────────────────────────────────────────────────────────┘');

const dashManifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic">
  <Period id="content1" duration="PT120S">
    <AdaptationSet mimeType="video/mp4">
      <Representation id="1" bandwidth="1000000"/>
    </AdaptationSet>
  </Period>
  <Period id="ad_preroll" duration="PT30S">
    <AdaptationSet contentType="ad">
      <Representation id="ad1" bandwidth="500000"/>
    </AdaptationSet>
  </Period>
  <Period id="content2" duration="PT180S">
    <AdaptationSet mimeType="video/mp4">
      <Representation id="2" bandwidth="1500000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

const dashResult = manifestRewriter.rewriteDASH(dashManifest);
console.log('');
console.log(`Modified: ${dashResult.modified}`);
console.log(`Segments removed: ${dashResult.segmentsRemoved}`);
console.log('');

// =============================================================================
// Summary
// =============================================================================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║                      TEST SUMMARY                          ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║ YouTube Ad Fields Stripped:  ${result.fieldsStripped.length.toString().padStart(3)}                          ║`);
console.log(`║ HLS Ad Segments Removed:     ${hlsResult.segmentsRemoved.toString().padStart(3)}                          ║`);
console.log(`║ DASH Ad Periods Removed:     ${dashResult.segmentsRemoved.toString().padStart(3)}                          ║`);
console.log(`║ Verification Checks Passed:  ${passed}/${checks.length}                          ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

if (passed === checks.length && result.modified && hlsResult.modified) {
    console.log('✅ STAGE 2 IMPLEMENTATION VERIFIED');
} else {
    console.log('❌ Some tests failed');
    process.exit(1);
}
