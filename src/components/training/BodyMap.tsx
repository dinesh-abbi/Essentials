import { memo } from 'react';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import { Colors, Hue, mix } from '@/constants/theme';

/**
 * The muscle atlas — front and back silhouettes with 14 tappable regions,
 * ported from Forma's web BodyMap to react-native-svg and redrawn in the
 * Glance palette: a flat graphite body, muscles a shade lighter, the picked
 * muscle in the training coral. A heat map tints every region by how much
 * work it got instead. Simplified illustration, not a medical model.
 */

export type BodySide = 'front' | 'back';

type Region = {
  id: string;
  label: string;
  paths: string[];
  fibers?: string[];
  mirror?: boolean;
  /** viewBox for the isolated close-up. */
  box: string;
};

const shoulder: Region = {
  id: 'shoulders',
  label: 'Shoulders',
  mirror: true,
  box: '72 100 156 70',
  paths: ['M108 108 C94 107 82 119 79 134 Q76 147 80 162 C87 160 94 151 99 141 Q104 124 115 116Z'],
  fibers: [
    'M97 113 Q79 129 81 155 M101 112 Q83 130 82 157 M105 112 Q89 132 84 155 M108 115 Q95 134 86 153 M110 116 Q101 134 90 150 M94 116 Q80 126 80 143',
  ],
};
const forearms: Region = {
  id: 'forearms',
  label: 'Forearms',
  mirror: true,
  box: '44 205 212 82',
  paths: ['M71 211 Q78 218 88 211 C90 226 75 258 62 280 L52 275 C57 252 55 234 71 211Z', 'M87 219 C82 243 68 264 63 278 L66 257Z'],
  fibers: ['M72 220 Q62 240 57 271 M78 219 Q72 244 61 275 M82 225 Q77 243 70 253'],
};

const FRONT: Region[] = [
  shoulder,
  {
    id: 'chest',
    label: 'Chest',
    mirror: true,
    box: '98 111 104 76',
    paths: ['M116 115 C126 117 138 118 148 122 L148 163 C147 175 131 181 116 174 C108 169 105 154 101 145 C108 136 109 122 116 115Z'],
    fibers: [
      'M110 139 Q126 120 145 124 M107 143 Q126 127 146 130 M107 145 Q125 133 146 138 M108 148 Q125 143 146 146 M109 150 Q125 154 145 153 M110 153 Q123 163 143 161 M112 156 Q122 170 141 167 M114 162 Q125 178 138 172',
    ],
  },
  {
    id: 'biceps',
    label: 'Biceps',
    mirror: true,
    box: '65 147 170 70',
    paths: ['M82 161 Q92 154 100 151 C101 168 97 186 90 198 Q83 213 77 209 C69 203 73 188 77 177Z'],
    fibers: ['M84 166 Q79 185 78 203 M88 163 Q84 187 80 207 M92 162 Q89 185 83 205 M96 159 Q96 183 87 200 M80 177 Q73 191 76 201'],
  },
  forearms,
  {
    id: 'abs',
    label: 'Abs',
    mirror: true,
    box: '123 178 54 100',
    paths: [
      'M134 182 Q141 179 147 181 L147 200 Q140 205 129 199Z',
      'M129 204 Q138 208 147 205 L147 223 Q139 229 129 224Z',
      'M129 230 Q139 233 147 230 L147 250 Q142 255 133 250Z',
      'M134 256 Q142 259 147 255 L147 276 Q138 273 134 256Z',
    ],
    fibers: ['M138 184 L136 198 M143 184 L142 200 M134 210 L134 222 M141 211 L141 225 M135 235 L137 247 M142 235 L143 249 M139 261 L143 271'],
  },
  {
    id: 'obliques',
    label: 'Obliques',
    mirror: true,
    box: '104 171 92 110',
    paths: ['M108 174 Q117 183 127 181 C122 210 125 240 130 254 L143 282 Q120 271 113 257 C120 234 106 210 108 174Z'],
    fibers: ['M110 182 L123 193 M111 193 L122 206 M113 207 L122 218 M115 221 L124 232 M117 234 L127 247 M117 248 L135 270'],
  },
  {
    id: 'quads',
    label: 'Quads',
    mirror: true,
    box: '97 285 106 141',
    paths: [
      'M115 292 C122 288 130 291 133 302 C138 328 131 380 122 405 Q118 411 115 401 C105 371 105 324 115 292Z',
      'M109 294 Q103 324 105 352 C103 377 110 397 114 407 Q115 380 113 350 Q110 321 117 294Z',
      'M139 303 Q148 324 143 350 C141 368 137 396 130 411 Q121 416 125 399 C133 368 135 332 139 303Z',
    ],
    fibers: ['M121 300 Q114 341 119 389 M127 305 Q125 351 122 380 M108 322 Q105 358 112 388 M140 328 Q139 369 130 401'],
  },
];

const BACK: Region[] = [
  shoulder,
  {
    id: 'upper-back',
    label: 'Upper back',
    mirror: true,
    box: '99 87 102 113',
    paths: [
      'M138 93 Q137 108 114 114 C130 124 140 153 148 188 L148 100Z',
      'M112 122 C105 133 103 147 108 161 Q124 166 140 177 C132 151 124 134 112 122Z',
    ],
    fibers: [
      'M138 106 L146 120 M130 114 L146 134 M125 121 L145 146 M127 137 L145 159 M110 133 L130 151 M108 145 L135 163 M111 155 L138 170',
    ],
  },
  {
    id: 'triceps',
    label: 'Triceps',
    mirror: true,
    box: '65 148 170 70',
    paths: ['M81 166 Q91 159 101 151 C100 172 95 200 83 212 L78 207 Q70 207 72 195Z', 'M95 160 Q91 184 84 198 L81 173Z'],
    fibers: ['M85 169 Q77 188 77 200 M96 169 Q93 194 85 207 M88 177 L84 190'],
  },
  forearms,
  {
    id: 'lats',
    label: 'Lats',
    mirror: true,
    box: '101 161 98 108',
    paths: ['M106 165 Q122 168 142 187 L146 205 Q133 237 123 260 C122 232 110 218 108 199Z'],
    fibers: ['M109 172 Q123 184 138 192 M109 182 Q122 195 137 199 M110 194 Q122 207 134 211 M113 207 Q123 219 131 223 M118 224 L127 236'],
  },
  {
    id: 'lower-back',
    label: 'Lower back',
    mirror: true,
    box: '123 196 54 93',
    paths: ['M144 204 L148 198 L148 282 Q137 282 131 270 C136 248 138 224 144 204Z'],
    fibers: ['M144 220 Q143 251 138 273 M146 231 L145 276'],
  },
  {
    id: 'glutes',
    label: 'Glutes',
    mirror: true,
    box: '98 266 104 66',
    paths: ['M122 272 Q132 274 143 285 Q148 293 148 306 C145 326 116 331 105 316 Q101 296 114 278Z'],
    fibers: ['M119 280 Q137 281 143 298 M111 289 Q130 285 142 305 M108 299 Q125 293 140 312 M109 309 Q125 303 136 319'],
  },
  {
    id: 'hamstrings',
    label: 'Hamstrings',
    mirror: true,
    box: '99 323 102 103',
    paths: [
      'M106 327 Q115 331 124 331 C117 355 116 386 119 413 L113 417 Q103 386 104 352Z',
      'M128 332 Q139 330 145 324 C146 352 140 381 130 416 L124 411 Q127 379 124 354Z',
    ],
    fibers: ['M110 336 Q106 371 114 402 M116 337 Q111 373 116 394 M134 337 Q129 372 128 399 M140 337 Q137 371 132 390'],
  },
  {
    id: 'calves',
    label: 'Calves',
    mirror: true,
    box: '98 424 104 103',
    paths: [
      'M115 433 Q124 434 124 457 C123 480 116 493 111 505 C102 493 101 474 104 454 Q107 437 115 433Z',
      'M128 434 C141 448 136 480 124 495 Q117 489 121 473Z',
    ],
    fibers: ['M113 442 Q105 469 111 491 M117 449 Q114 475 112 485 M128 444 Q132 466 125 483'],
  },
];

const SILHOUETTE =
  'M135 82 C128 77 126 66 126 55 C122 48 126 45 127 46 L128 34 C132 17 166 16 172 34 L173 46 C178 45 178 52 174 57 Q174 76 164 83 L164 96 C171 103 184 103 196 109 C216 116 224 137 224 157 C226 173 232 190 231 207 C241 224 241 252 250 275 C256 283 260 295 260 305 Q259 310 256 304 L250 292 L251 312 Q250 318 247 311 L244 297 L244 315 Q241 320 239 312 L237 296 L235 309 Q232 313 231 307 L232 287 Q223 291 223 286 L233 273 C225 254 214 236 211 214 C201 200 198 182 193 170 C190 192 184 210 182 231 Q180 246 185 260 C193 278 198 297 198 322 C199 350 190 389 188 412 Q185 427 189 442 C202 476 192 506 188 526 L189 554 Q193 565 199 570 C203 576 199 581 190 580 L174 578 Q167 576 168 568 L169 548 C167 522 159 491 159 465 L160 439 Q155 413 155 392 L151 340 Q150 331 149 340 L145 392 Q145 413 140 439 L141 465 C141 491 133 522 131 548 L132 568 Q133 576 126 578 L110 580 C101 581 97 576 101 570 Q110 561 111 554 L112 526 C108 506 98 476 111 442 Q115 427 112 412 C110 389 101 350 102 322 C102 297 107 278 115 260 Q120 246 118 231 C116 210 110 192 107 170 C102 182 99 200 89 214 C86 236 75 254 67 273 L77 286 Q77 291 68 287 L69 307 Q68 313 65 309 L63 296 L61 312 Q59 320 56 315 L56 297 L53 311 Q50 318 49 312 L50 292 L44 304 Q41 310 40 305 C40 295 44 283 50 275 C59 252 59 224 69 207 C68 190 74 173 76 157 C76 137 84 116 104 109 C116 103 129 103 136 96Z';
const LANDMARKS_SHARED =
  'M137 85 Q143 92 150 92 Q157 92 163 85 M136 96 Q139 109 147 119 M164 96 Q161 109 153 119 M150 120 L150 280 M112 521 L117 552 L114 567 M188 521 L183 552 L186 567 M55 280 L61 283 M245 280 L239 283';
const LANDMARKS_FRONT =
  'M117 272 Q131 279 144 289 L150 309 L156 289 Q169 279 183 272 M118 451 Q111 472 117 507 M182 451 Q189 472 183 507';
const LANDMARKS_BACK = 'M132 74 Q150 81 168 74 M150 94 L150 321 M112 512 Q120 532 120 553 M188 512 Q180 532 180 553';
/** Untargeted muscle mass (traps, adductors, shins) so the body reads as muscular. */
const UNDERLAY_SHARED = 'M138 89 Q139 104 147 118 L139 111 L130 100Z M162 89 Q161 104 153 118 L161 111 L170 100Z';
const UNDERLAY_FRONT =
  'M136 280 Q146 291 149 314 L144 358 Q140 331 138 306Z M164 280 Q154 291 151 314 L156 358 Q160 331 162 306Z M113 442 C102 468 110 501 117 527 L122 543 Q119 500 125 472 Q127 453 123 441Z M187 442 C198 468 190 501 183 527 L178 543 Q181 500 175 472 Q173 453 177 441Z';

const MIRROR = 'matrix(-1,0,0,1,300,0)';
const C = Colors.dark;
const train = Hue.train;

/** Palette: graphite body, muscles a step lighter, picked muscle in coral. */
const SKIN = C.surface2;
const SKIN_EDGE = C.hairline;
const MUSCLE = mix('#FFFFFF', C.surface2, 0.16);
const MUSCLE_EDGE = C.bg;
const FIBER = 'rgba(0,0,0,0.28)';

/** 0..1 → body colour … training coral. */
export function heatColor(value: number): string {
  const v = Math.min(Math.max(value, 0), 1);
  return v === 0 ? MUSCLE : mix(train.main, MUSCLE, 0.25 + v * 0.75);
}

/** Which views a region appears in, so callers can pick the side that shows it. */
export const regionSides: Record<string, BodySide[]> = {};
for (const region of FRONT) (regionSides[region.id] ||= []).push('front');
for (const region of BACK) (regionSides[region.id] ||= []).push('back');

/**
 * The view that shows the given regions best. The first id is the primary
 * target and outweighs the supporting ones, so a lat pulldown shows the back
 * rather than the view that merely holds more of its muscles.
 */
export function bestSide(ids: string[]): BodySide {
  const score = (target: BodySide) =>
    ids.reduce((total, id, index) => (regionSides[id]?.includes(target) ? total + (index === 0 ? 4 : 1) : total), 0);
  return score('back') > score('front') ? 'back' : 'front';
}

export const BodyMap = memo(function BodyMap({
  side,
  selected = null,
  onSelect,
  heat,
  isolated = false,
  plain = false,
  width: maxWidth,
  maxHeight = Infinity,
}: {
  side: BodySide;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Region id → 0..1. Tints the whole body instead of highlighting one pick. */
  heat?: Record<string, number>;
  /** Only the selected region, zoomed to its box. */
  isolated?: boolean;
  /** Thumbnail mode: no landmarks, fibres or outlines. */
  plain?: boolean;
  width: number;
  /** Shrinks the drawing to fit when the viewBox is tall (isolated close-ups). */
  maxHeight?: number;
}) {
  const regions = side === 'front' ? FRONT : BACK;
  const visible = isolated ? regions.filter((r) => r.id === selected) : regions;
  const viewBox = isolated ? (visible[0]?.box ?? '0 0 300 600') : '0 0 300 600';
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const width = Math.min(maxWidth, (maxHeight * vbW) / vbH);
  const height = (width * vbH) / vbW;

  const fillFor = (id: string) =>
    heat ? heatColor(heat[id] || 0) : selected === id ? train.main : MUSCLE;

  const regionShapes = (region: Region) => {
    const isSel = selected === region.id;
    const fibers = !plain && !heat && region.fibers?.length;
    return (
      <>
        {region.paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
        {fibers ? (
          <G clipPath={`url(#clip-${region.id})`} fill="none" stroke={isSel ? train.deep : FIBER} strokeWidth={0.6} strokeLinecap="round">
            {region.fibers!.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
        ) : null}
      </>
    );
  };

  return (
    <Svg
      width={width}
      height={height}
      viewBox={viewBox}
      accessibilityLabel={isolated ? 'Selected muscle close-up' : `${side === 'front' ? 'Front' : 'Back'} muscle map`}
    >
      <Defs>
        {regions.map((region) => (
          <ClipPath id={`clip-${region.id}`} key={region.id}>
            {region.paths.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </ClipPath>
        ))}
      </Defs>

      {!isolated && (
        <G>
          <Path d={SILHOUETTE} fill={SKIN} stroke={plain ? 'none' : SKIN_EDGE} strokeWidth={0.8} />
          {!plain && (
            <>
              <Path d={UNDERLAY_SHARED} fill={MUSCLE} opacity={0.6} />
              {side === 'front' && <Path d={UNDERLAY_FRONT} fill={MUSCLE} opacity={0.6} />}
              <Path
                d={`${LANDMARKS_SHARED} ${side === 'front' ? LANDMARKS_FRONT : LANDMARKS_BACK}`}
                fill="none"
                stroke={SKIN_EDGE}
                strokeWidth={0.9}
                strokeLinecap="round"
              />
            </>
          )}
        </G>
      )}

      {visible.map((region) => {
        const isSel = selected === region.id;
        const muted = !heat && !!selected && !isSel && !isolated;
        return (
          <G
            key={region.id}
            fill={fillFor(region.id)}
            stroke={plain ? 'none' : isSel ? train.main : MUSCLE_EDGE}
            strokeWidth={isSel ? 1.4 : 0.7}
            opacity={muted ? 0.7 : 1}
            onPress={onSelect ? () => onSelect(region.id) : undefined}
          >
            {regionShapes(region)}
            {region.mirror && <G transform={MIRROR}>{regionShapes(region)}</G>}
          </G>
        );
      })}
    </Svg>
  );
});

/** Front/back region lists, for named selectors next to the map. */
export const REGIONS_BY_SIDE: Record<BodySide, { id: string; label: string }[]> = {
  front: FRONT.map(({ id, label }) => ({ id, label })),
  back: BACK.map(({ id, label }) => ({ id, label })),
};
