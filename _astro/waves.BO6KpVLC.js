var e={solid:0,dashed:1},t=12,n=4,r=2.2,i=640,a=64,o=a*Math.sqrt(Math.PI/2)/i,s=16e5,c=`#version 300 es
precision highp float;
precision highp int;
uniform vec2 uView;
uniform float uRatio;
uniform vec2 uAxis;
uniform float uSpacing;
uniform float uStep;
uniform vec2 uStart;
uniform float uAmplitude;
uniform vec2 uFrequency;
uniform vec2 uDrift;
uniform float uTwist;
uniform uint uSeed;
uniform sampler2D uField;
uniform ivec2 uFieldSize;
uniform float uCell;
uniform float uLimit;
uniform float uReach;
uniform float uReveal;
uniform float uBand;
out float vAcross;
out float vAlong;
out float vEnergy;
out float vShow;
out float vPhase;

const vec2 GRADIENTS[12] = vec2[12](
  vec2(1.0, 1.0), vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(-1.0, -1.0),
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
  vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(0.0, 1.0), vec2(0.0, -1.0)
);

vec2 gradient(vec2 cell) {
  uvec2 q = uvec2(ivec2(cell) + 65536) + uvec2(uSeed * 7919u, uSeed * 104729u);
  q = 1103515245u * ((q >> 1u) ^ q.yx);
  uint n = 1103515245u * (q.x ^ (q.y >> 3u));
  return GRADIENTS[(n >> 16u) % 12u];
}

float ease(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float perlin(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  float n00 = dot(gradient(i), f);
  float n10 = dot(gradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float n01 = dot(gradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float n11 = dot(gradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  vec2 u = vec2(ease(f.x), ease(f.y));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

vec2 node(ivec2 cell) {
  return texelFetch(uField, clamp(cell, ivec2(0), uFieldSize - 1), 0).xy;
}

void weights(float f, out vec4 w, out vec4 d) {
  float g = 1.0 - f;
  float f2 = f * f;
  float f3 = f2 * f;
  w = vec4(g * g * g, 3.0 * f3 - 6.0 * f2 + 4.0, -3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0, f3) / 6.0;
  d = vec4(-g * g, 3.0 * f2 - 4.0 * f, -3.0 * f2 + 2.0 * f + 1.0, f2) * 0.5;
}

vec2 field(vec2 point, out mat2 slope) {
  vec2 t = point / uCell;
  vec2 base = floor(t);
  vec2 f = t - base;
  vec4 wx;
  vec4 dx;
  vec4 wy;
  vec4 dy;
  weights(f.x, wx, dx);
  weights(f.y, wy, dy);
  ivec2 origin = ivec2(base) - 1;
  vec2 value = vec2(0.0);
  vec2 alongX = vec2(0.0);
  vec2 alongY = vec2(0.0);
  for (int j = 0; j < 4; j++) {
    vec2 row = vec2(0.0);
    vec2 rowSlope = vec2(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 tap = node(origin + ivec2(i, j));
      row += tap * wx[i];
      rowSlope += tap * dx[i];
    }
    value += row * wy[j];
    alongX += rowSlope * wy[j];
    alongY += row * dy[j];
  }
  float size = length(value);
  float scale = size > 0.0001 ? uLimit * tanh(size / uLimit) / size : 1.0;
  slope = mat2(alongX, alongY) * (scale / uCell);
  return value * scale;
}

vec2 wave(vec2 rest) {
  float turn = perlin(rest * uFrequency + uDrift) * 12.0 * uTwist;
  vec2 local = rest + vec2(cos(turn), sin(turn) * 0.5) * uAmplitude;
  return uView * 0.5 + vec2(local.x * uAxis.x - local.y * uAxis.y, local.x * uAxis.y + local.y * uAxis.x);
}

void main() {
  int index = gl_VertexID >> 1;
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  float u = uStart.x + float(gl_InstanceID) * uSpacing;
  float v = uStart.y + float(index) * uStep;
  vec2 flowing = wave(vec2(u, v));
  vec2 bend = wave(vec2(u, v + uStep)) - wave(vec2(u, v - uStep));
  mat2 slope;
  vec2 shift = field(flowing, slope);
  vec2 point = flowing + shift;
  float energy = length(shift);
  vec2 tangent = bend + slope * bend;
  float span = max(length(tangent), 0.0001);
  vec2 normal = vec2(-tangent.y, tangent.x) / span;
  vec2 corner = point + normal * side * uReach / uRatio;
  vAcross = side * uReach;
  vAlong = v;
  vEnergy = energy;
  vShow = clamp((uReveal - abs(u)) / uBand, 0.0, 1.0);
  uint line = uint(gl_InstanceID) * 747796405u + uSeed * 2891336453u + 1u;
  line = ((line >> ((line >> 28u) + 4u)) ^ line) * 277803737u;
  vPhase = float((line >> 22u) ^ line) / 4294967295.0;
  vec2 clip = corner / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,l=`#version 300 es
precision highp float;
uniform vec2 uView;
uniform float uRatio;
uniform float uHalf;
uniform float uThin;
uniform int uStyle;
uniform float uPeriod;
uniform float uFlow;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uBase;
uniform float uHeat;
uniform float uFade;
uniform float uOpacity;
in float vAcross;
in float vAlong;
in float vEnergy;
in float vShow;
in float vPhase;
out vec4 outColor;

float smootherstep(float edge, float x) {
  float t = clamp(x / max(edge, 0.0001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  float coverage = clamp(uHalf + 0.5 - abs(vAcross), 0.0, 1.0) * uThin;
  if (uStyle == 1) {
    float phase = (vAlong + uFlow) / uPeriod + vPhase;
    float blur = max(fwidth(phase), 0.0001);
    coverage *= clamp((0.25 - abs(fract(phase) - 0.5)) / blur + 0.5, 0.0, 1.0);
  }
  float heat = smoothstep(0.0, uHeat, vEnergy);
  vec2 uv = gl_FragCoord.xy / (uView * uRatio);
  float edge = uFade * 0.5;
  float mask = smootherstep(edge, uv.x) * smootherstep(edge, 1.0 - uv.x) * smootherstep(edge, uv.y) * smootherstep(edge, 1.0 - uv.y);
  float alpha = coverage * mix(uBase, 1.0, heat) * mask * vShow * uOpacity;
  outColor = vec4(mix(uColor, uAccent, heat) * alpha, alpha);
}`,u=(e,t,n)=>Math.min(n,Math.max(t,e)),d=e=>{let t=u(e,0,1);return t*t*t*(t*(t*6-15)+10)},f=(e,t,n)=>{let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null},p=e=>{let t=f(e,e.VERTEX_SHADER,c),n=f(e,e.FRAGMENT_SHADER,l),r=e.createProgram();if(!t||!n||!r)return null;if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),e.deleteShader(t),e.deleteShader(n),!e.getProgramParameter(r,e.LINK_STATUS))return e.deleteProgram(r),null;let i={},a=e.getProgramParameter(r,e.ACTIVE_UNIFORMS);for(let t=0;t<a;t++){let n=e.getActiveUniform(r,t);n&&(i[n.name]=e.getUniformLocation(r,n.name))}return{program:r,uniforms:i}};function m(c,{lineColor:l=`#ffffff`,accentColor:f,backgroundColor:m=`transparent`,lineStyle:h=`solid`,spacing:g=10,lineWidth:_=1,rotation:v=0,amplitude:y=32,scale:b=1,twist:x=1,speed:S=1,variation:C=0,mouseInteraction:w=!0,mouseRadius:T=175,mouseStrength:E=1,bounce:D=.5,returnDuration:O=1.4,clickRipple:k=!0,intro:A=!0,fade:j=0,opacity:M=1,lightMode:N=!1,paused:P=!1,dpr:F}={}){let I={current:{lineColor:String(l),accentColor:f?String(f):``,lineStyle:e[h]??0,spacing:Math.max(2,g),lineWidth:Math.max(.25,_),rotation:v,amplitude:Math.max(0,y),scale:Math.max(.05,b),twist:Math.max(0,x),speed:S,variation:Math.max(0,Math.round(C)),mouseInteraction:w,mouseRadius:Math.max(20,T),mouseStrength:Math.max(0,E),bounce:u(D,0,1),returnDuration:Math.max(.2,O),clickRipple:k,intro:A,fade:u(j,0,1),opacity:u(M,0,1),lightMode:N,paused:P,dpr:F}};{let e=document.createElement(`canvas`);e.className=`waves__canvas`,e.setAttribute(`aria-hidden`,`true`),c.appendChild(e);let l=e?.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});if(!c||!e||!l)return;let f=p(l);if(!f)return;let m=f.uniforms,h=l.createVertexArray(),g=l.createTexture();l.bindTexture(l.TEXTURE_2D,g),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MIN_FILTER,l.NEAREST),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MAG_FILTER,l.NEAREST),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_S,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_T,l.CLAMP_TO_EDGE),l.pixelStorei(l.UNPACK_ALIGNMENT,1);let _=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0}),v=window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches??!1,y=new Map,b=e=>{if(y.has(e))return y.get(e);let t=[1,1,1];if(_){_.clearRect(0,0,1,1),_.fillStyle=`#ffffff`,_.fillStyle=e,_.fillRect(0,0,1,1);let[n,r,i]=_.getImageData(0,0,1,1).data;t=[n/255,r/255,i/255]}return y.set(e,t),t},x=e=>{let t=e.map(e=>e**2.2),n=.2126*t[0]+.7152*t[1]+.0722*t[2],r=Math.min(1,.045/Math.max(n,1e-4));return t.map(e=>(e*r)**(1/2.2))},S={width:1,height:1,ratio:1},C={cols:0,rows:0,shift:new Float32Array,speed:new Float32Array,top:0,bottom:-1,left:0,right:-1},w={x:0,y:0,sx:0,sy:0,vx:0,vy:0,inside:!1},T=[],E={flow:0,intro:I.current.intro&&!v?0:1},D=0,O=0,k=!0,A=e=>Math.max(12,e.mouseRadius*.5),j=()=>{C.cols=Math.ceil(S.width/t)+2,C.rows=Math.ceil(S.height/t)+2,C.shift=new Float32Array(C.cols*C.rows*2),C.speed=new Float32Array(C.cols*C.rows*2),C.top=0,C.bottom=-1,C.left=0,C.right=-1,l.bindTexture(l.TEXTURE_2D,g),l.texImage2D(l.TEXTURE_2D,0,l.RG32F,C.cols,C.rows,0,l.RG,l.FLOAT,C.shift)},M=(e,n,r,i)=>{let a=u(Math.floor(e/t),0,C.cols-1),o=u(Math.ceil(r/t),0,C.cols-1),s=u(Math.floor(n/t),0,C.rows-1),c=u(Math.ceil(i/t),0,C.rows-1),l=C.bottom<C.top;C.top=l?s:Math.min(C.top,s),C.bottom=l?c:Math.max(C.bottom,c),C.left=l?a:Math.min(C.left,a),C.right=l?o:Math.max(C.right,o)},N=e=>{let n=I.current,r=1-Math.exp(-e/.045),s=w.sx+(w.x-w.sx)*r,c=w.sy+(w.y-w.sy)*r,u=1-Math.exp(-e/.06);w.vx+=((s-w.sx)/e-w.vx)*u,w.vy+=((c-w.sy)/e-w.vy)*u,w.sx=s,w.sy=c;let f=1-.85*n.bounce,p=4/(f*n.returnDuration),m=n.mouseRadius,h=Math.hypot(w.vx,w.vy),_=n.mouseInteraction&&w.inside&&!v?26e3*Math.tanh(h/1400)*n.mouseStrength:0;_>1&&M(w.sx-m,w.sy-m,w.sx+m,w.sy+m);let y=[];for(let t=T.length-1;t>=0;t--){let n=T[t];n.age+=e;let r=n.age*i,a=1-r/n.range;if(a<=0){T.splice(t,1);continue}let s=r+192;M(n.x-s,n.y-s,n.x+s,n.y+s),y.push({x:n.x,y:n.y,front:r,power:150*p*a*Math.sqrt(a)/o})}if(C.bottom<C.top)return!1;let b=p*p,x=2*f*p,S=Math.min(16,Math.max(1,Math.ceil(e/Math.min(1/120,.6/p)))),E=e/S,D=h>.001?w.vx/h:0,O=h>.001?w.vy/h:0,{cols:k,shift:A,speed:j,left:N,right:P}=C,F=0;for(let e=C.top;e<=C.bottom;e++){let n=e*t;for(let r=N;r<=P;r++){let i=r*t,o=(e*k+r)*2,s=0,c=0;if(_>1){let e=Math.hypot(i-w.sx,n-w.sy);if(e<m){let t=d(1-e/m)*_;s+=D*t,c+=O*t}}for(let e of y){let t=i-e.x,r=n-e.y,o=Math.hypot(t,r),l=(o-e.front)/a;if(o>.001&&Math.abs(l)<3){let n=e.power*Math.exp(-l*l*2)*d(o/56);s+=t/o*n,c+=r/o*n}}let l=A[o],u=A[o+1],f=j[o],p=j[o+1];for(let e=0;e<S;e++)f+=(s-b*l-x*f)*E,p+=(c-b*u-x*p)*E,l+=f*E,u+=p*E;A[o]=l,A[o+1]=u,j[o]=f,j[o+1]=p,F=Math.max(F,Math.abs(l)+Math.abs(u)+(Math.abs(f)+Math.abs(p))*.05)}}let L=C.top,R=C.bottom-C.top+1;if(F<.02&&_<=1&&!y.length){for(let e=C.top;e<=C.bottom;e++)A.fill(0,(e*k+N)*2,(e*k+P+1)*2),j.fill(0,(e*k+N)*2,(e*k+P+1)*2);C.top=0,C.bottom=-1}return l.bindTexture(l.TEXTURE_2D,g),l.texSubImage2D(l.TEXTURE_2D,0,0,L,k,R,l.RG,l.FLOAT,A.subarray(L*k*2,(L+R)*k*2)),C.bottom>=C.top},P=()=>{let r=I.current,i=r.rotation*Math.PI/180,a=Math.cos(i),o=Math.sin(i),c=A(r),p=r.amplitude*1.1+c+r.spacing*2+8,_=(S.width*Math.abs(a)+S.height*Math.abs(o))/2+p,y=(S.width*Math.abs(o)+S.height*Math.abs(a))/2+p,w=Math.ceil(_/r.spacing),T=w*2+1,D=n,O=Math.ceil(y*2/D)+1;T*O*2>s&&(O=Math.max(16,Math.floor(s/(T*2))),D=y*2/(O-1));let k=r.lineWidth*S.ratio,j=Math.max(.5,k/2),M=j+1,N=E.intro,P=r.intro&&!v?(1-(1-u(N/.7,0,1))**3)*_*1.3:1e6,F=r.intro&&!v?d((N-.1)/.9):1,L=b(r.lineColor),R=r.lightMode?x(L):L,z=r.accentColor?b(r.accentColor):R,B=E.flow+r.variation*37.1;l.viewport(0,0,e.width,e.height),l.clearColor(0,0,0,0),l.clear(l.COLOR_BUFFER_BIT),l.enable(l.BLEND),l.blendFunc(l.ONE,l.ONE_MINUS_SRC_ALPHA),l.useProgram(f.program),l.bindVertexArray(h),l.activeTexture(l.TEXTURE0),l.bindTexture(l.TEXTURE_2D,g),l.uniform1i(m.uField,0),l.uniform2f(m.uView,S.width,S.height),l.uniform1f(m.uRatio,S.ratio),l.uniform2f(m.uAxis,a,o),l.uniform1f(m.uSpacing,r.spacing),l.uniform1f(m.uStep,D),l.uniform2f(m.uStart,-w*r.spacing,-y),l.uniform1f(m.uAmplitude,r.amplitude*F),l.uniform2f(m.uFrequency,.002/r.scale,.0015/r.scale),l.uniform2f(m.uDrift,B*.025,B*.0075),l.uniform1f(m.uTwist,r.twist),l.uniform1ui(m.uSeed,r.variation),l.uniform2i(m.uFieldSize,C.cols,C.rows),l.uniform1f(m.uCell,t),l.uniform1f(m.uLimit,c),l.uniform1f(m.uReach,M),l.uniform1f(m.uReveal,P),l.uniform1f(m.uBand,Math.max(1,_*.3)),l.uniform1f(m.uHalf,j),l.uniform1f(m.uThin,Math.min(1,k)),l.uniform1i(m.uStyle,r.lineStyle),l.uniform1f(m.uPeriod,r.spacing*2.6),l.uniform1f(m.uFlow,E.flow*16%(r.spacing*2.6)),l.uniform3fv(m.uColor,R),l.uniform3fv(m.uAccent,z),l.uniform1f(m.uBase,.62),l.uniform1f(m.uHeat,c*.55),l.uniform1f(m.uFade,r.fade),l.uniform1f(m.uOpacity,r.opacity),l.drawArraysInstanced(l.TRIANGLE_STRIP,0,O*2,T)},F=e=>{if(D=0,!k||document.hidden)return;let t=I.current,n=O?u((e-O)/1e3,5e-4,.05):1/60;if(O=e,t.paused){E.intro=1,P(),O=0;return}v||(E.flow+=n*t.speed),!t.intro||v?E.intro=1:E.intro<1&&(E.intro=Math.min(1,E.intro+n/r));let i=N(n);P();let a=w.inside&&t.mouseInteraction&&Math.hypot(w.vx,w.vy)>1;!v||i||a||T.length||E.intro<1?D=requestAnimationFrame(F):O=0},L=()=>{!D&&k&&!document.hidden&&(D=requestAnimationFrame(F))},R=()=>{let t=I.current,n=Math.max(1,c.clientWidth),r=Math.max(1,c.clientHeight),i=Math.min(t.dpr||window.devicePixelRatio||1,2);S.width=n,S.height=r,e.width=Math.max(1,Math.round(n*i)),e.height=Math.max(1,Math.round(r*i)),S.ratio=e.width/n,j(),P(),L()},z=(e,t)=>{let n=c.getBoundingClientRect(),r=e.clientX-n.left,i=e.clientY-n.top,a=r>=0&&i>=0&&r<=n.width&&i<=n.height;return(t||a&&!w.inside)&&(w.sx=r,w.sy=i,w.vx=0,w.vy=0),w.inside=a,w.x=r,w.y=i,{x:r,y:i,rect:n,inside:a}},B=e=>{z(e,!1),I.current.paused||L()},V=e=>{let t=I.current,{x:n,y:r,rect:i,inside:a}=z(e,e.pointerType!==`mouse`);a&&t.clickRipple&&!t.paused&&!v&&(T.push({x:n,y:r,age:0,range:Math.max(360,Math.hypot(i.width,i.height)*.55)}),T.length>6&&T.shift()),L()},H=e=>{e.pointerType!==`mouse`&&(w.inside=!1)},U=()=>{w.inside=!1,L()},W=()=>{O=0,L()},G=new ResizeObserver(R);G.observe(c);let K=new IntersectionObserver(e=>{k=e.some(e=>e.isIntersecting),k&&(O=0,L())});return K.observe(c),window.addEventListener(`pointermove`,B,{passive:!0}),window.addEventListener(`pointerdown`,V,{passive:!0}),window.addEventListener(`pointerup`,H,{passive:!0}),window.addEventListener(`pointercancel`,H,{passive:!0}),document.documentElement.addEventListener(`pointerleave`,U),document.addEventListener(`visibilitychange`,W),R(),I.current.dpr,()=>{cancelAnimationFrame(D),G.disconnect(),K.disconnect(),window.removeEventListener(`pointermove`,B),window.removeEventListener(`pointerdown`,V),window.removeEventListener(`pointerup`,H),window.removeEventListener(`pointercancel`,H),document.documentElement.removeEventListener(`pointerleave`,U),document.removeEventListener(`visibilitychange`,W),l.deleteProgram(f.program),l.deleteVertexArray(h),l.deleteTexture(g),l.getExtension(`WEBGL_lose_context`)?.loseContext()}}}export{m as initWaves};