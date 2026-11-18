// Hand-written WebGL background for the hero: a slow flowing gradient field in pine and a trace of
// lime, warped by noise, with a soft light that follows the pointer. One full-screen triangle, one
// fragment shader, no library (about 3 KB). Rendered at half resolution and at most 30 fps; the
// caller pauses it off screen and on hidden tabs. Returns null when WebGL is unavailable, and the
// CSS gradient under it (.hero-aurora) stays the whole background.

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform float e;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
vec2 uv=gl_FragCoord.xy/r;vec2 q=uv;q.x*=r.x/r.y;
float s=t*.035;
vec2 w=vec2(fbm(q*1.6+s),fbm(q*1.6-s+4.1));
float f=fbm(q*1.2+w*1.8+vec2(s*.6,-s*.4));
vec3 bg=vec3(.039,.051,.043);vec3 pine=vec3(.114,.227,.165);vec3 lime=vec3(.71,.92,.416);
vec3 c=mix(bg,pine,smoothstep(.35,.95,f)*.85);
float ridge=smoothstep(.62,.7,f)-smoothstep(.7,.8,f);
c+=lime*ridge*.05;
vec2 mp=m;mp.x*=r.x/r.y;float d=distance(q,mp);
c+=lime*.07*e*exp(-d*d*7.);
c=mix(c,pine*1.2,.18*exp(-d*d*2.5)*e);
float vig=smoothstep(1.25,.25,distance(uv,vec2(.62,.42)));
c=mix(bg,c,vig);
c+=(h(gl_FragCoord.xy+t)-.5)*.012;
gl_FragColor=vec4(c,1.);}`

export type Field = {
  setPointer(x: number, y: number): void
  setRunning(on: boolean): void
  destroy(): void
}

const RES = 0.5
const FRAME_MS = 1000 / 30

export function createField(canvas: HTMLCanvasElement, onFirstFrame?: () => void): Field | null {
  const ctx = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: 'low-power',
  })
  if (!ctx) return null
  const gl: WebGLRenderingContext = ctx

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = shader(gl.VERTEX_SHADER, VERT)
  const fs = shader(gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()
  if (!vs || !fs || !prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const uR = gl.getUniformLocation(prog, 'r')
  const uT = gl.getUniformLocation(prog, 't')
  const uM = gl.getUniformLocation(prog, 'm')
  const uE = gl.getUniformLocation(prog, 'e')

  // Pointer target and its eased value (0..1, y up); `energy` fades the light in when the pointer
  // moves and out when it rests, so a still mouse leaves a still picture.
  const target = { x: 0.7, y: 0.6 }
  const eased = { x: 0.7, y: 0.6 }
  let energy = 0
  let lastMove = 0
  let raf = 0
  let last = 0
  let running = false
  let first = true
  const start = performance.now()

  const size = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * RES))
    const h = Math.max(1, Math.round(canvas.clientHeight * RES))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }
  const ro = new ResizeObserver(size)
  ro.observe(canvas)
  size()

  function frame(now: number) {
    raf = 0
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (now - last < FRAME_MS) return
    const dt = Math.min(0.1, (now - (last || now)) / 1000)
    last = now
    const k = 1 - Math.exp(-dt * 2.2)
    eased.x += (target.x - eased.x) * k
    eased.y += (target.y - eased.y) * k
    const want = now - lastMove < 1800 ? 1 : 0.25
    energy += (want - energy) * (1 - Math.exp(-dt * 1.2))
    gl.uniform2f(uR, canvas.width, canvas.height)
    gl.uniform1f(uT, (now - start) / 1000)
    gl.uniform2f(uM, eased.x, eased.y)
    gl.uniform1f(uE, energy)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (first) {
      first = false
      onFirstFrame?.()
    }
  }

  return {
    setPointer(x, y) {
      target.x = x
      target.y = 1 - y
      lastMove = performance.now()
    },
    setRunning(on) {
      if (on === running) return
      running = on
      if (on && !raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      } else if (!on && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    destroy() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
