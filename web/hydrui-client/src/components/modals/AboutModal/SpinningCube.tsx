import React, { useEffect, useRef } from "react";

import { Mat4 } from "@/utils/matrix";

const vsSource = `
attribute vec4 aVertexPosition;
attribute vec4 aVertexColor;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform lowp float uTime;
varying lowp vec4 vColor;
varying lowp float vZ;
void main(void) {
  lowp vec4 pos = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
  gl_Position = pos;
  vColor = aVertexColor;
  vZ = pos.z;
}
`;

const fsSource = `
varying lowp vec4 vColor;
varying lowp float vZ;
void main(void) {
  lowp vec4 color = vColor;
  color.rgb *= 0.8 + sin(vZ * 3.0) * 0.2;
  color.a -= vZ / 10.0;
  gl_FragColor = color;
}
`;

function initShaderProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string,
) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)!;
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)!;

  const shaderProgram = gl.createProgram()!;
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.warn(
      `An error occurred linking the shader program: ${gl.getProgramInfoLog(shaderProgram)}`,
    );
    return null;
  }

  return shaderProgram;
}

function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`,
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

interface SpinningCubeProps {
  width?: number;
  height?: number;
  className?: string;
}

export const SpinningCube: React.FC<SpinningCubeProps> = ({
  width = 200,
  height = 200,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("webgl");
    if (!context) {
      console.info("Unable to initialize WebGL");
      return;
    }
    const gl = context;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
        vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(
          shaderProgram,
          "uProjectionMatrix",
        ),
        modelViewMatrix: gl.getUniformLocation(
          shaderProgram,
          "uModelViewMatrix",
        ),
        time: gl.getUniformLocation(shaderProgram, "uTime"),
      },
    };

    const positions = [
      // Front
      -0.7, -0.7, 1.0, 0.7, -0.7, 1.0, 0.7, 0.7, 1.0, -0.7, 0.7, 1.0,
      // Back
      -0.7, -0.7, -1.0, -0.7, 0.7, -1.0, 0.7, 0.7, -1.0, 0.7, -0.7, -1.0,
      // Top
      -0.7, 1.0, -0.7, -0.7, 1.0, 0.7, 0.7, 1.0, 0.7, 0.7, 1.0, -0.7,
      // Bottom
      -0.7, -1.0, -0.7, 0.7, -1.0, -0.7, 0.7, -1.0, 0.7, -0.7, -1.0, 0.7,
      // Right
      1.0, -0.7, -0.7, 1.0, 0.7, -0.7, 1.0, 0.7, 0.7, 1.0, -0.7, 0.7,
      // Left
      -1.0, -0.7, -0.7, -1.0, -0.7, 0.7, -1.0, 0.7, 0.7, -1.0, 0.7, -0.7,
    ];

    const colors = [
      // Front
      0, 1, 1, 0.8, 0, 1, 1, 0.8, 0, 1, 1, 0.8, 0, 1, 1, 0.8,
      // Back
      1, 0, 1, 0.8, 1, 0, 1, 0.8, 1, 0, 1, 0.8, 1, 0, 1, 0.8,
      // Top
      1, 1, 0, 0.8, 1, 1, 0, 0.8, 1, 1, 0, 0.8, 1, 1, 0, 0.8,
      // Bottom
      0, 0, 1, 0.8, 0, 0, 1, 0.8, 0, 0, 1, 0.8, 0, 0, 1, 0.8,
      // Right
      0, 1, 0, 0.8, 0, 1, 0, 0.8, 0, 1, 0, 0.8, 0, 1, 0, 0.8,
      // Left
      1, 0, 0, 0.8, 1, 0, 0, 0.8, 1, 0, 0, 0.8, 1, 0, 0, 0.8,
    ];

    const indices = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
      14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ];

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );

    const buffers = {
      position: positionBuffer,
      color: colorBuffer,
      indices: indexBuffer,
    };

    let rotation = 0.0;
    let then = 0;

    function render(now: number) {
      now *= 0.001;
      const deltaTime = now - then;
      then = now;

      rotation += deltaTime;

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fieldOfView = (30 * Math.PI) / 180;
      const aspect = width / height;
      const zNear = 0.1;
      const zFar = 100.0;
      const projectionMatrix = new Mat4();
      projectionMatrix.perspective(fieldOfView, aspect, zNear, zFar);

      const modelViewMatrix = new Mat4();
      modelViewMatrix.translate(0.0, 0.0, -6.0);
      modelViewMatrix.rotate(rotation * 0.8 + Math.sin(now * 0.5), 0, 1, 0);
      modelViewMatrix.rotate(rotation * 0.5 - Math.cos(now * 0.5), 1, 0, 0);

      // Position
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        3, // numComponents
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

      // Color
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexColor,
        4, // numComponents
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

      // Indices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

      gl.useProgram(programInfo.program);
      gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix.elements,
      );
      gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix.elements,
      );
      gl.uniform1f(programInfo.uniformLocations.time, now);
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

      animationRef.current = requestAnimationFrame(render);
    }

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
};
