import type maplibregl from 'maplibre-gl';
import type { mat4 } from 'gl-matrix';

// ── Vertex Shader ─────────────────────────────────────────────────────────────────
// Receives raw [lng, lat] degrees and projects them to MapLibre's Mercator
// clip-space in the shader -- no GeoJSON, no intermediate JS objects.
const VERT = `
  precision highp float;

  attribute vec2 a_pos;       // [longitude, latitude] in degrees
  uniform mat4 u_matrix;      // MapLibre Mercator projection matrix
  uniform float u_point_size;

  const float PI = 3.14159265358979323846;

  // Convert lng/lat degrees -> MapLibre Mercator [0, 1] space
  // x: 0 = -180°, 1 = +180°
  // y: 0 = ~85°N (north), 1 = ~85°S (south)
  vec2 toMercator(vec2 lngLat) {
    float x = (lngLat.x + 180.0) / 360.0;
    float latRad = lngLat.y * PI / 180.0;
    float y = (1.0 - log(tan(PI / 4.0 + latRad / 2.0)) / PI) / 2.0;
    return vec2(x, y);
  }

  void main() {
    gl_Position  = u_matrix * vec4(toMercator(a_pos), 0.0, 1.0);
    gl_PointSize = u_point_size;
  }
`;

// ── Fragment Shader ───────────────────────────────────────────────────────────────
// Renders each gl.POINT as a smooth anti-aliased circle with a stroke ring.
const FRAG = `
  precision mediump float;

  uniform vec4  u_color;              // fill RGBA
  uniform vec4  u_stroke_color;       // stroke RGBA
  uniform float u_stroke_width_frac;  // stroke thickness as fraction of radius

  void main() {
    // gl_PointCoord: (0,0) top-left .. (1,1) bottom-right of the point sprite
    float dist = length(gl_PointCoord - 0.5) * 2.0; // 0 = center, 1 = edge

    if (dist > 1.0) discard;    // outside the circle -> transparent

    float inner = 1.0 - u_stroke_width_frac;

    if (dist > inner) {
      // Stroke ring with soft outer edge
      float t = (dist - inner) / u_stroke_width_frac;
      gl_FragColor = vec4(u_stroke_color.rgb, u_stroke_color.a * (1.0 - smoothstep(0.8, 1.0, t)));
    } else {
      // Fill with soft edge toward the stroke boundary
      float alpha = u_color.a * (1.0 - smoothstep(0.75, 1.0, dist / max(inner, 0.001)));
      gl_FragColor = vec4(u_color.rgb, alpha);
    }
  }
`;

// ── Public types ──────────────────────────────────────────────────────────────────

export interface PointLayerOptions {
  /** Point diameter in CSS pixels (default: 10) */
  pointSize?: number;
  /** Fill color as [r, g, b, a] in 0..1 range (default: #89b4fa at 90%) */
  color?: [number, number, number, number];
  /** Stroke color as [r, g, b, a] in 0..1 range (default: #1e1e2e) */
  strokeColor?: [number, number, number, number];
  /** Stroke width in CSS pixels (default: 1.5) */
  strokeWidth?: number;
}

// ── PointLayer ────────────────────────────────────────────────────────────────────

/**
 * MapLibre CustomLayerInterface that renders a large set of lng/lat points
 * directly via WebGL -- no GeoJSON serialization, no MapLibre style pipeline.
 *
 * Pipeline:
 *   DuckDB-WASM query  →  Float32Array [lng0,lat0, lng1,lat1, …]
 *                      →  GPU vertex buffer  →  gl.drawArrays(POINTS)
 */
export class PointLayer implements maplibregl.CustomLayerInterface {
  readonly id: string;
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private gl!: WebGLRenderingContext;
  private program!: WebGLProgram;
  private buffer!: WebGLBuffer;

  // Raw coordinate buffer -- flat Float32Array: [lng0,lat0, lng1,lat1, ...]
  private coords: Float32Array = new Float32Array(0);
  // True when coords were updated but not yet uploaded to GPU
  private dirty = false;

  private readonly pointSize: number;
  private readonly color: [number, number, number, number];
  private readonly strokeColor: [number, number, number, number];
  private readonly strokeWidthFrac: number;

  constructor(id: string, options: PointLayerOptions = {}) {
    this.id         = id;
    this.pointSize  = options.pointSize ?? 10;
    this.color      = options.color       ?? [0.537, 0.706, 0.980, 0.9];  // #89b4fa
    this.strokeColor = options.strokeColor ?? [0.118, 0.118, 0.180, 1.0]; // #1e1e2e
    // Convert stroke pixel width to a fraction of the point radius
    const strokePx     = options.strokeWidth ?? 1.5;
    this.strokeWidthFrac = Math.min((strokePx * 2) / this.pointSize, 1.0);
  }

  // ── MapLibre lifecycle ────────────────────────────────────────────────────────

  onAdd(_map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.gl      = gl;
    this.program = this.buildProgram(gl);
    this.buffer  = gl.createBuffer()!;

    // Upload data that may have arrived before the layer was added to the map
    if (this.dirty && this.coords.length > 0) {
      this.upload(gl);
    }
  }

  onRemove(_map: maplibregl.Map, gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
  }

  render(gl: WebGLRenderingContext, matrix: mat4): void {
    if (this.coords.length === 0) return;

    // Lazy GPU upload -- called here in case setData() ran before onAdd()
    if (this.dirty) this.upload(gl);

    gl.useProgram(this.program);

    // Uniforms
    gl.uniformMatrix4fv(this.uloc(gl, 'u_matrix'),           false, matrix as number[]);
    gl.uniform1f(       this.uloc(gl, 'u_point_size'),       this.pointSize);
    gl.uniform4fv(      this.uloc(gl, 'u_color'),            this.color);
    gl.uniform4fv(      this.uloc(gl, 'u_stroke_color'),     this.strokeColor);
    gl.uniform1f(       this.uloc(gl, 'u_stroke_width_frac'), this.strokeWidthFrac);

    // Bind coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const aPos = gl.getAttribLocation(this.program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Alpha blending for smooth circles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.POINTS, 0, this.coords.length / 2);

    // Cleanup state
    gl.disableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Replace all rendered points.
   * @param coords Flat Float32Array -- [lng0, lat0, lng1, lat1, ...]
   *               Built directly from DuckDB Arrow result; zero extra allocations.
   */
  setData(coords: Float32Array): void {
    this.coords = coords;
    this.dirty  = true;
    // If onAdd already ran, upload immediately so the next frame is ready
    if (this.gl) this.upload(this.gl);
  }

  /** Number of points currently in the layer. */
  get pointCount(): number {
    return this.coords.length / 2;
  }

  /**
   * Find the index of the nearest point to a map click.
   * Uses screen-space distance so pixel radius is intuitive.
   *
   * @param map         MapLibre map instance (for project())
   * @param lngLat      Click position
   * @param pixelRadius Maximum hit distance in CSS pixels (default: 12)
   * @returns           Row index into the original data array, or -1 if none found
   */
  findNearest(
    map: maplibregl.Map,
    lngLat: maplibregl.LngLat,
    pixelRadius = 12,
  ): number {
    if (this.coords.length === 0) return -1;

    const click     = map.project(lngLat);
    const threshold = pixelRadius * pixelRadius;
    let best     = -1;
    let bestDist = threshold;

    for (let i = 0; i < this.coords.length; i += 2) {
      const pt = map.project([this.coords[i], this.coords[i + 1]] as [number, number]);
      const d2 = (pt.x - click.x) ** 2 + (pt.y - click.y) ** 2;
      if (d2 < bestDist) {
        bestDist = d2;
        best     = i / 2;
      }
    }
    return best;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private upload(gl: WebGLRenderingContext): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.coords, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.dirty = false;
  }

  private uloc(gl: WebGLRenderingContext, name: string): WebGLUniformLocation {
    // Uniform location lookup; for a production layer these would be cached
    return gl.getUniformLocation(this.program, name)!;
  }

  private buildProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vert = this.compileShader(gl, gl.VERTEX_SHADER,   VERT);
    const frag = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('[PointLayer] Program link failed: ' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('[PointLayer] Shader compile failed: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  }
}
