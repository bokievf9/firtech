// Go-live stage background: a slow aurora of lime and the seven department hues, domain-warped
// noise ribbons that drift, a soft pointer light, grain, and a gentle pulse on every second tick.
// One full-screen triangle, one fragment shader, no library. Forked from the public hero field
// (src/components/live/field-gl.ts) with its own uniforms. Resolution is half of the CSS size at
// device pixel ratio capped to 1.5, 30 fps at most; the caller pauses it on hidden tabs and
// off-screen. Returns null when WebGL is unavailable (the CSS gradient under it stays).

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

// r resolution, t time, m pointer, e pointer energy, l light theme, p tick pulse, o over (red),
// g progress 0..1 (more ribbons light up as the list fills), b page background colour.
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform float e;uniform float l;uniform float p;uniform float o;uniform float g;uniform vec3 b;
float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 q){vec2 i=floor(q),f=fract(q);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 q){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n(q);q=q*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 pal(float x){x=fract(x)*7.;
vec3 A=vec3(.71,.92,.416),B=vec3(.396,.443,.706),C=vec3(.816,.275,.498),D=vec3(.867,.416,.133),E=vec3(.106,.616,.549),F=vec3(.204,.518,.824),G=vec3(.525,.341,.816);
vec3 c=mix(A,B,smoothstep(0.,1.,x));
c=mix(c,C,smoothstep(1.,2.,x));c=mix(c,D,smoothstep(2.,3.,x));c=mix(c,E,smoothstep(3.,4.,x));
c=mix(c,F,smoothstep(4.,5.,x));c=mix(c,G,smoothstep(5.,6.,x));c=mix(c,A,smoothstep(6.,7.,x));return c;}
void main(){
vec2 uv=gl_FragCoord.xy/r;vec2 q=uv;q.x*=r.x/r.y;
float s=t*.03;
vec2 w=vec2(fbm(q*1.3+vec2(s,0.)),fbm(q*1.3+vec2(4.1,-s)));
float f=fbm(q*vec2(.9,1.5)+w*1.7+vec2(s*.5,-s*.3));
float f2=fbm(q*vec2(1.2,1.1)-w*1.3+vec2(-s*.4,s*.6)+7.);
float r1=1.-abs(f*2.-1.);r1=pow(r1,2.5);
float r2=1.-abs(f2*2.-1.);r2=pow(r2,3.);
vec3 c1=pal(f*.8+s*1.6+uv.x*.25);
vec3 c2=pal(f2*.9+s*1.1+.45-uv.y*.2);
vec3 lime=vec3(.71,.92,.416);vec3 red=vec3(.9,.2,.15);
c1=mix(c1,red,o);c2=mix(c2,red,o*.8);
float k=.5+.32*g;
float vig=smoothstep(1.3,.2,distance(uv,vec2(.5,.5)));
vec3 dark=b+c1*r1*.62*k*vig+c2*r2*.45*k*vig+c1*pow(r1,.5)*.05*vig;
vec3 light=mix(b,mix(c1,vec3(1.),.25),clamp(r1*.9*k*vig,0.,1.));
light=mix(light,mix(c2,vec3(1.),.2),clamp(r2*.7*k*vig,0.,1.));
vec3 c=mix(dark,light,l);
vec2 mp=m;mp.x*=r.x/r.y;float d=distance(q,mp);
c+=mix(lime*.08,vec3(-.02,-.01,-.04),l)*e*exp(-d*d*6.);
float cd=distance(uv,vec2(.5,.5));
vec3 halo=mix(lime,red,o);
c+=mix(halo*.09,vec3(-.03,-.015,-.04),l)*p*exp(-cd*cd*5.);
c+=(h(gl_FragCoord.xy+t)-.5)*.014;
gl_FragColor=vec4(c,1.);}`

export type StageField = {
  setPointer(x: number, y: number): void
  setRunning(on: boolean): void
  setOver(over: boolean): void
  setProgress(p: number): void
  pulse(): void
  destroy(): void
}

const MAX_DPR = 1.5
const RES = 0.5
const FRAME_MS = 1000 / 30

// "rgb(10, 13, 11)" or "#0a0d0b" (the --color-bg token), to 0..1 floats; null when the format is unexpected.
function parseColor(css: string): [number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css)
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
  const x = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css.trim())
  return x ? [parseInt(x[1]!, 16) / 255, parseInt(x[2]!, 16) / 255, parseInt(x[3]!, 16) / 255] : null
}

export function createStageField(canvas: HTMLCanvasElement, onFirstFrame?: () => void): StageField | null {
  const ctx = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' })
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

  const U = (name: string) => gl.getUniformLocation(prog, name)
  const uR = U('r'), uT = U('t'), uM = U('m'), uE = U('e'), uL = U('l'), uP = U('p'), uO = U('o'), uG = U('g'), uB = U('b')

  const target = { x: 0.5, y: 0.5 }
  const eased = { x: 0.5, y: 0.5 }
  let energy = 0
  let lastMove = 0
  let pulse = 0
  let over = 0
  let overTarget = 0
  let prog01 = 0
  let progTarget = 0
  let bg: [number, number, number] = [0.04, 0.05, 0.04]
  let raf = 0
  let last = 0
  let running = false
  let first = true
  const start = performance.now()

  const readBg = () => {
    const c = parseColor(getComputedStyle(document.documentElement).getPropertyValue('--color-bg'))
    if (c) bg = c
  }
  readBg()

  const size = () => {
    const scale = RES * Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(canvas.clientWidth * scale))
    const h = Math.max(1, Math.round(canvas.clientHeight * scale))
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
    energy += ((now - lastMove < 1800 ? 1 : 0.2) - energy) * (1 - Math.exp(-dt * 1.2))
    pulse *= Math.exp(-dt * 3)
    over += (overTarget - over) * (1 - Math.exp(-dt * 1.5))
    prog01 += (progTarget - prog01) * (1 - Math.exp(-dt * 2))
    gl.uniform2f(uR, canvas.width, canvas.height)
    gl.uniform1f(uT, (now - start) / 1000)
    gl.uniform2f(uM, eased.x, eased.y)
    gl.uniform1f(uE, energy)
    gl.uniform1f(uL, document.documentElement.dataset.theme === 'light' ? 1 : 0)
    gl.uniform1f(uP, pulse)
    gl.uniform1f(uO, over)
    gl.uniform1f(uG, prog01)
    gl.uniform3f(uB, bg[0], bg[1], bg[2])
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
    setOver(v) {
      overTarget = v ? 1 : 0
    },
    setProgress(v) {
      progTarget = Math.max(0, Math.min(1, v))
    },
    pulse() {
      pulse = 1
      readBg()
    },
    destroy() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
