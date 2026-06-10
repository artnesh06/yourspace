(function(){

  function initDither(containerId){
    const container = document.getElementById(containerId);
    if(!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if(!gl) return;

    const vsSource = `
      attribute vec2 a_position;
      void main(){
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_mouseRadius;

      float dither4x4(vec2 pos, float brightness){
        int x = int(mod(pos.x, 4.0));
        int y = int(mod(pos.y, 4.0));
        int index = x + y * 4;
        float limit = 0.0;
        if(index==0) limit=0.0625;
        else if(index==1) limit=0.5625;
        else if(index==2) limit=0.1875;
        else if(index==3) limit=0.6875;
        else if(index==4) limit=0.8125;
        else if(index==5) limit=0.3125;
        else if(index==6) limit=0.9375;
        else if(index==7) limit=0.4375;
        else if(index==8) limit=0.25;
        else if(index==9) limit=0.75;
        else if(index==10) limit=0.125;
        else if(index==11) limit=0.625;
        else if(index==12) limit=1.0;
        else if(index==13) limit=0.5;
        else if(index==14) limit=0.875;
        else if(index==15) limit=0.375;
        return brightness < limit ? 0.0 : 1.0;
      }

      void main(){
        vec2 pixelCoord = gl_FragCoord.xy;
        float pixelSize = 3.0;
        vec2 pixUV = floor(pixelCoord / pixelSize) * pixelSize / u_resolution;

        float waveFreq = 3.0;
        float waveAmp = 0.3;
        float waveSpeed = 0.05;

        float wave = sin(pixUV.x * waveFreq * 6.2832 + u_time * waveSpeed * 6.2832) * waveAmp;
        wave += sin(pixUV.y * waveFreq * 4.0 + u_time * waveSpeed * 4.0) * waveAmp * 0.5;
        wave += sin((pixUV.x + pixUV.y) * waveFreq * 3.0 - u_time * waveSpeed * 5.0) * waveAmp * 0.3;

        vec2 mouseUV = u_mouse / u_resolution;
        float dist = distance(pixUV, mouseUV);
        float mouseEffect = smoothstep(u_mouseRadius, 0.0, dist) * 0.5;
        wave += mouseEffect;

        float brightness = clamp(0.5 + wave * 0.5, 0.0, 1.0);
        float dithered = dither4x4(floor(pixelCoord / pixelSize), brightness);

        vec3 color = mix(vec3(1.0), vec3(0.91, 0.0, 0.02), dithered * 0.15);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(type, source){
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if(!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 1,-1, -1,1,
      -1,1, 1,-1, 1,1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uMouseRadius = gl.getUniformLocation(program, 'u_mouseRadius');

    let mouseX = -999, mouseY = -999;
    let time = 0;

    function resize(){
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      if(w === 0 || h === 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', e=>{
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if(x >= 0 && x <= rect.width && y >= 0 && y <= rect.height){
        mouseX = x * dpr;
        mouseY = (rect.height - y) * dpr;
      } else {
        mouseX = -999;
        mouseY = -999;
      }
    });

    function render(){
      if(container.offsetParent === null){
        // Container hidden, skip but keep loop
        requestAnimationFrame(render);
        return;
      }
      resize();
      time += 1/60;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform1f(uMouseRadius, 0.25);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }

    render();
  }

  // Init whichever dither containers exist on this page
  initDither('dither-bg');
  initDither('dither-bg-app');

})();
